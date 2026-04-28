// @vitest-environment node

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  WINBORG_SCHEDULER_BACKEND,
  WINDOWS_TASK_SCHEDULER_BACKEND,
  buildQueryTaskArgs,
  buildCreateTaskArgs,
  createWindowsTaskScheduler,
  getScheduleBackend,
  getTaskNameForJob,
  shouldTrackWindowsTask,
  shouldUseWindowsTaskScheduler,
} = require('../../main/windowsTaskScheduler');

describe('main/windowsTaskScheduler', () => {
  const launchContext = {
    executablePath: 'C:\\Program Files\\WinBorg\\WinBorg.exe',
    appPathArg: null,
  };

  test('defaults to the internal WinBorg scheduler backend', () => {
    expect(getScheduleBackend({ scheduleEnabled: true })).toBe(WINBORG_SCHEDULER_BACKEND);
    expect(shouldUseWindowsTaskScheduler({ scheduleEnabled: true })).toBe(false);
    expect(shouldTrackWindowsTask({ scheduleEnabled: true })).toBe(false);
  });

  test('builds query args for a Windows scheduled task', () => {
    const job = {
      id: 'job-query',
      name: 'Query Backup',
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
    };

    expect(buildQueryTaskArgs(job)).toEqual(['/Query', '/TN', getTaskNameForJob(job)]);
    expect(shouldTrackWindowsTask(job)).toBe(true);
  });

  test('builds a daily scheduled task command', () => {
    const job = {
      id: 'job-1',
      name: 'Daily Backup',
      scheduleEnabled: true,
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
      scheduleType: 'daily',
      scheduleTime: '14:30',
    };

    const args = buildCreateTaskArgs(job, launchContext);
    expect(args).toEqual(expect.arrayContaining(['/SC', 'DAILY', '/ST', '14:30']));
    expect(args).toEqual(expect.arrayContaining(['/TN', getTaskNameForJob(job)]));
    expect(args).toEqual(expect.arrayContaining(['/TR', expect.stringContaining('--run-scheduled-job')]));
  });

  test('builds an hourly scheduled task with the configured minute', () => {
    const job = {
      id: 'job-2',
      name: 'Hourly Backup',
      scheduleEnabled: true,
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
      scheduleType: 'hourly',
      scheduleTime: '09:15',
    };

    const args = buildCreateTaskArgs(job, launchContext);
    expect(args).toEqual(expect.arrayContaining(['/SC', 'HOURLY', '/MO', '1', '/ST', '00:15']));
  });

  test('builds a weekly scheduled task with the configured weekday', () => {
    const job = {
      id: 'job-3',
      name: 'Weekly Backup',
      scheduleEnabled: true,
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
      scheduleType: 'weekly',
      scheduleTime: '08:45',
      scheduleWeekday: 1,
    };

    const args = buildCreateTaskArgs(job, launchContext);
    expect(args).toEqual(expect.arrayContaining(['/SC', 'WEEKLY', '/D', 'MON', '/ST', '08:45']));
  });

  test('syncJobs fails on non-Windows when external tasks are requested', async () => {
    const scheduler = createWindowsTaskScheduler({
      spawnCapture: vi.fn(),
      platform: 'linux',
      logger: { warn: vi.fn() },
    });

    const result = await scheduler.syncJobs([], [{
      id: 'job-4',
      name: 'External Backup',
      scheduleEnabled: true,
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
      scheduleType: 'daily',
      scheduleTime: '10:00',
    }], launchContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('only available on Windows');
  });

  test('syncJobs deletes renamed tasks and upserts current external jobs', async () => {
    const spawnCapture = vi.fn().mockResolvedValue({ code: 0, stdout: 'ok', stderr: '', error: null });
    const scheduler = createWindowsTaskScheduler({
      spawnCapture,
      platform: 'win32',
      logger: { warn: vi.fn() },
    });

    const previousJobs = [{
      id: 'job-5',
      name: 'Old Name',
      scheduleEnabled: true,
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
      scheduleType: 'daily',
      scheduleTime: '06:00',
    }];

    const nextJobs = [{
      id: 'job-5',
      name: 'New Name',
      scheduleEnabled: true,
      scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
      scheduleType: 'daily',
      scheduleTime: '06:00',
    }];

    const result = await scheduler.syncJobs(previousJobs, nextJobs, launchContext);

    expect(result.success).toBe(true);
    expect(spawnCapture).toHaveBeenNthCalledWith(
      1,
      'schtasks.exe',
      expect.arrayContaining(['/Delete', '/TN', getTaskNameForJob(previousJobs[0]), '/F']),
      expect.any(Object)
    );
    expect(spawnCapture).toHaveBeenNthCalledWith(
      2,
      'schtasks.exe',
      expect.arrayContaining(['/Create', '/TN', getTaskNameForJob(nextJobs[0]), '/F']),
      expect.any(Object)
    );
  });

  test('getJobStatuses reports whether tracked tasks exist', async () => {
    const spawnCapture = vi
      .fn()
      .mockResolvedValueOnce({ code: 0, stdout: 'task exists', stderr: '', error: null })
      .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'ERROR: The system cannot find the file specified.', error: null });

    const scheduler = createWindowsTaskScheduler({
      spawnCapture,
      platform: 'win32',
      logger: { warn: vi.fn() },
    });

    const jobs = [
      {
        id: 'job-6',
        name: 'Present Task',
        scheduleEnabled: true,
        scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
        scheduleType: 'daily',
        scheduleTime: '06:00',
      },
      {
        id: 'job-7',
        name: 'Missing Task',
        scheduleEnabled: true,
        scheduleBackend: WINDOWS_TASK_SCHEDULER_BACKEND,
        scheduleType: 'daily',
        scheduleTime: '06:00',
      },
    ];

    const result = await scheduler.getJobStatuses(jobs);

    expect(result.success).toBe(true);
    expect(result.statuses['job-6']).toEqual(expect.objectContaining({ success: true, exists: true }));
    expect(result.statuses['job-7']).toEqual(expect.objectContaining({ success: true, exists: false }));
  });
});