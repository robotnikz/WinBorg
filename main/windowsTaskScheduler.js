const WINBORG_SCHEDULER_BACKEND = 'winborg';
const WINDOWS_TASK_SCHEDULER_BACKEND = 'windows-task-scheduler';

const WEEKDAY_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function sanitizeTaskNameSegment(value, fallback = 'job') {
    const clean = String(value || '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();

    return clean || fallback;
}

function getScheduleBackend(job) {
    return job && job.scheduleBackend === WINDOWS_TASK_SCHEDULER_BACKEND
        ? WINDOWS_TASK_SCHEDULER_BACKEND
        : WINBORG_SCHEDULER_BACKEND;
}

function shouldUseWindowsTaskScheduler(job) {
    return !!job && job.scheduleEnabled === true && getScheduleBackend(job) === WINDOWS_TASK_SCHEDULER_BACKEND;
}

function shouldTrackWindowsTask(job) {
    return !!job && getScheduleBackend(job) === WINDOWS_TASK_SCHEDULER_BACKEND;
}

function normalizeScheduleTime(value, fallback = '00:00') {
    if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
        return value;
    }

    return fallback;
}

function getWeekdayToken(weekday) {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return WEEKDAY_MAP[0];
    return WEEKDAY_MAP[weekday];
}

function getTaskNameForJob(job) {
    const name = sanitizeTaskNameSegment(job && job.name, 'Job');
    return `WinBorg-${name}-${job && job.id ? job.id : 'unknown'}`;
}

function quoteWindowsCommandArg(value) {
    const rawValue = String(value ?? '');
    const escapedValue = rawValue
        .replace(/(\\*)"/g, '$1$1\\"')
        .replace(/(\\+)$/g, '$1$1');

    return `"${escapedValue}"`;
}

function buildTaskRunCommand(launchContext, jobId) {
    if (!launchContext || !launchContext.executablePath) {
        throw new Error('Missing WinBorg launch context for Task Scheduler command.');
    }

    const args = [];
    if (launchContext.appPathArg) args.push(launchContext.appPathArg);
    args.push('--hidden', '--run-scheduled-job', jobId, '--scheduler-source', WINDOWS_TASK_SCHEDULER_BACKEND);

    return [launchContext.executablePath, ...args].map(quoteWindowsCommandArg).join(' ');
}

function buildTaskScheduleArgs(job) {
    const scheduleType = job && job.scheduleType;

    if (scheduleType === 'daily') {
        return ['/SC', 'DAILY', '/ST', normalizeScheduleTime(job.scheduleTime, '14:00')];
    }

    if (scheduleType === 'hourly') {
        const [, minute] = normalizeScheduleTime(job.scheduleTime, '00:00').split(':');
        return ['/SC', 'HOURLY', '/MO', '1', '/ST', `00:${minute}`];
    }

    if (scheduleType === 'weekly') {
        return [
            '/SC', 'WEEKLY',
            '/D', getWeekdayToken(job && job.scheduleWeekday),
            '/ST', normalizeScheduleTime(job.scheduleTime, '14:00')
        ];
    }

    return null;
}

function buildCreateTaskArgs(job, launchContext) {
    const scheduleArgs = buildTaskScheduleArgs(job);
    if (!scheduleArgs) {
        throw new Error(`Unsupported Task Scheduler schedule type: ${job && job.scheduleType}`);
    }

    return [
        '/Create',
        '/TN', getTaskNameForJob(job),
        '/TR', buildTaskRunCommand(launchContext, job.id),
        ...scheduleArgs,
        '/F'
    ];
}

function buildDeleteTaskArgs(job) {
    return ['/Delete', '/TN', getTaskNameForJob(job), '/F'];
}

function buildQueryTaskArgs(job) {
    return ['/Query', '/TN', getTaskNameForJob(job)];
}

function getTaskSchedulerError(result, fallback) {
    const detail = [result && result.stderr, result && result.stdout, result && result.error]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .find(Boolean);

    return detail || fallback;
}

function isTaskMissing(result) {
    const detail = `${result && result.stderr ? result.stderr : ''}\n${result && result.stdout ? result.stdout : ''}\n${result && result.error ? result.error : ''}`.toLowerCase();
    return detail.includes('cannot find') || detail.includes('does not exist') || detail.includes('cannot find the file specified');
}

function createWindowsTaskScheduler({ spawnCapture, platform = process.platform, logger = console } = {}) {
    async function upsertJob(job, launchContext) {
        if (!shouldUseWindowsTaskScheduler(job)) {
            return { success: true, skipped: true };
        }

        if (platform !== 'win32') {
            return { success: false, error: 'Windows Task Scheduler is only available on Windows.' };
        }

        if (!launchContext || !launchContext.executablePath) {
            return { success: false, error: 'WinBorg launch context could not be resolved.' };
        }

        try {
            const result = await spawnCapture('schtasks.exe', buildCreateTaskArgs(job, launchContext), { timeoutMs: 30000 });
            if (result.error || result.code !== 0) {
                return {
                    success: false,
                    error: getTaskSchedulerError(result, `Failed to create scheduled task for ${job.name}.`),
                    taskName: getTaskNameForJob(job),
                };
            }

            return { success: true, taskName: getTaskNameForJob(job) };
        } catch (error) {
            logger.warn && logger.warn('[TaskScheduler] Failed to create or update task', error);
            return { success: false, error: error && error.message ? error.message : String(error) };
        }
    }

    async function deleteJob(job) {
        if (!job || getScheduleBackend(job) !== WINDOWS_TASK_SCHEDULER_BACKEND) {
            return { success: true, skipped: true };
        }

        if (platform !== 'win32') {
            return { success: true, skipped: true };
        }

        try {
            const result = await spawnCapture('schtasks.exe', buildDeleteTaskArgs(job), { timeoutMs: 30000 });
            if (result.error || (result.code !== 0 && !isTaskMissing(result))) {
                return {
                    success: false,
                    error: getTaskSchedulerError(result, `Failed to delete scheduled task for ${job.name}.`),
                    taskName: getTaskNameForJob(job),
                };
            }

            return { success: true, taskName: getTaskNameForJob(job) };
        } catch (error) {
            logger.warn && logger.warn('[TaskScheduler] Failed to delete task', error);
            return { success: false, error: error && error.message ? error.message : String(error) };
        }
    }

    async function syncJobs(previousJobs = [], nextJobs = [], launchContext) {
        const previousExternalJobs = (Array.isArray(previousJobs) ? previousJobs : []).filter(shouldUseWindowsTaskScheduler);
        const nextExternalJobs = (Array.isArray(nextJobs) ? nextJobs : []).filter(shouldUseWindowsTaskScheduler);

        if (platform !== 'win32') {
            if (nextExternalJobs.length > 0) {
                return { success: false, error: 'Windows Task Scheduler is only available on Windows.' };
            }

            return { success: true, skipped: true };
        }

        const nextTaskNames = new Set(nextExternalJobs.map((job) => getTaskNameForJob(job)));
        const failures = [];

        for (const previousJob of previousExternalJobs) {
            const previousTaskName = getTaskNameForJob(previousJob);
            if (nextTaskNames.has(previousTaskName)) continue;

            const deletion = await deleteJob(previousJob);
            if (!deletion.success) failures.push(deletion);
        }

        for (const nextJob of nextExternalJobs) {
            const syncResult = await upsertJob(nextJob, launchContext);
            if (!syncResult.success) failures.push(syncResult);
        }

        if (failures.length > 0) {
            return {
                success: false,
                error: failures[0].error || 'Failed to synchronize one or more Windows scheduled tasks.',
                details: failures,
            };
        }

        return { success: true };
    }

    async function queryJob(job) {
        if (!shouldTrackWindowsTask(job)) {
            return {
                success: true,
                skipped: true,
                taskName: getTaskNameForJob(job),
                backend: getScheduleBackend(job),
            };
        }

        if (platform !== 'win32') {
            return {
                success: true,
                unsupported: true,
                exists: false,
                taskName: getTaskNameForJob(job),
                backend: getScheduleBackend(job),
            };
        }

        try {
            const result = await spawnCapture('schtasks.exe', buildQueryTaskArgs(job), { timeoutMs: 30000 });
            if (result.error || result.code !== 0) {
                if (isTaskMissing(result)) {
                    return {
                        success: true,
                        exists: false,
                        taskName: getTaskNameForJob(job),
                        backend: getScheduleBackend(job),
                    };
                }

                return {
                    success: false,
                    exists: false,
                    error: getTaskSchedulerError(result, `Failed to query scheduled task for ${job.name}.`),
                    taskName: getTaskNameForJob(job),
                    backend: getScheduleBackend(job),
                };
            }

            return {
                success: true,
                exists: true,
                taskName: getTaskNameForJob(job),
                backend: getScheduleBackend(job),
            };
        } catch (error) {
            logger.warn && logger.warn('[TaskScheduler] Failed to query task', error);
            return {
                success: false,
                exists: false,
                error: error && error.message ? error.message : String(error),
                taskName: getTaskNameForJob(job),
                backend: getScheduleBackend(job),
            };
        }
    }

    async function getJobStatuses(jobs = []) {
        const trackedJobs = (Array.isArray(jobs) ? jobs : []).filter(shouldTrackWindowsTask);
        const statuses = {};

        for (const job of trackedJobs) {
            statuses[job.id] = await queryJob(job);
        }

        return { success: true, statuses };
    }

    return {
        upsertJob,
        deleteJob,
        syncJobs,
        queryJob,
        getJobStatuses,
    };
}

module.exports = {
    WINBORG_SCHEDULER_BACKEND,
    WINDOWS_TASK_SCHEDULER_BACKEND,
    sanitizeTaskNameSegment,
    getScheduleBackend,
    shouldUseWindowsTaskScheduler,
    getWeekdayToken,
    getTaskNameForJob,
    buildTaskRunCommand,
    buildTaskScheduleArgs,
    buildCreateTaskArgs,
    buildDeleteTaskArgs,
    buildQueryTaskArgs,
    quoteWindowsCommandArg,
    createWindowsTaskScheduler,
    shouldTrackWindowsTask,
};