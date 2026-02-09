import React, { useEffect, useMemo, useState } from 'react';

import { BackupJob, Repository, View } from '../types';
import Button from '../components/Button';
import JobsModal from '../components/JobsModal';
import { Briefcase, CalendarClock, Plus, Server } from 'lucide-react';
import { getNextRunForRepo } from '../utils/formatters';

interface JobsViewProps {
  repos: Repository[];
  jobs: BackupJob[];
  onChangeView: (view: View) => void;

  onAddJob: (job: BackupJob) => void;
  onUpdateJob: (job: BackupJob) => void;
  onDeleteJob: (jobId: string) => void;
  onRunJob: (jobId: string) => void;

  openJobsRepoId?: string | null;
  onOpenJobsConsumed?: () => void;
}

const JobsView: React.FC<JobsViewProps> = ({
  repos,
  jobs,
  onChangeView,
  onAddJob,
  onUpdateJob,
  onDeleteJob,
  onRunJob,
  openJobsRepoId,
  onOpenJobsConsumed,
}) => {
  const [jobsRepo, setJobsRepo] = useState<Repository | null>(null);
  const [jobsModalOpenTo, setJobsModalOpenTo] = useState<'list' | 'create'>('list');

  const reposWithJobSummary = useMemo(() => {
    return repos
      .map((repo) => {
        const repoJobs = jobs.filter((j) => j.repoId === repo.id);
        const scheduledJobs = repoJobs.filter((j) => j.scheduleEnabled);
        const nextRun = getNextRunForRepo(jobs, repo.id);

        return {
          repo,
          totalJobs: repoJobs.length,
          scheduledJobs: scheduledJobs.length,
          nextRun,
        };
      })
      .sort((a, b) => {
        if (a.scheduledJobs !== b.scheduledJobs) return b.scheduledJobs - a.scheduledJobs;
        if (a.totalJobs !== b.totalJobs) return b.totalJobs - a.totalJobs;
        return a.repo.name.localeCompare(b.repo.name);
      });
  }, [repos, jobs]);

  useEffect(() => {
    if (!openJobsRepoId) return;

    const repo = repos.find((r) => r.id === openJobsRepoId) ?? null;
    if (!repo) return;

    setJobsRepo(repo);
    setJobsModalOpenTo('list');
    onOpenJobsConsumed?.();
  }, [openJobsRepoId, onOpenJobsConsumed, repos]);

  const openJobsForRepo = (repo: Repository, openTo: 'list' | 'create') => {
    setJobsRepo(repo);
    setJobsModalOpenTo(openTo);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Jobs</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage jobs and schedules per repository.</p>
        </div>
      </div>

      {repos.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
          <Server className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">No Repositories</h3>
          <p className="text-slate-500 text-sm mb-4">Add a repository first, then create your first scheduled backup job.</p>
          <Button onClick={() => onChangeView(View.REPOSITORIES)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Repository
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {reposWithJobSummary.map(({ repo, totalJobs, scheduledJobs, nextRun }) => (
            <div
              key={repo.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/75 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate" title={repo.name}>
                      {repo.name}
                    </h3>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Jobs:</span> {totalJobs}{' '}
                      <span className="text-slate-400">({scheduledJobs} scheduled)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      {nextRun ? (
                        <span className="font-medium text-purple-700 dark:text-purple-400" title="Next scheduled run">
                          {nextRun}
                        </span>
                      ) : totalJobs === 0 ? (
                        <span className="font-medium text-slate-600 dark:text-slate-300">No jobs yet</span>
                      ) : (
                        <span className="font-medium text-yellow-700 dark:text-yellow-400">No schedule enabled</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button onClick={() => openJobsForRepo(repo, totalJobs === 0 ? 'create' : 'list')}>
                    <Briefcase className="w-4 h-4 mr-2" />
                    {totalJobs === 0 ? 'Create First Job' : 'Manage Jobs'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {jobsRepo && (
        <JobsModal
          repo={jobsRepo}
          jobs={jobs.filter((j) => j.repoId === jobsRepo.id)}
          isOpen={true}
          openTo={jobsModalOpenTo}
          onClose={() => setJobsRepo(null)}
          onAddJob={onAddJob}
          onUpdateJob={onUpdateJob}
          onDeleteJob={onDeleteJob}
          onRunJob={onRunJob}
        />
      )}
    </div>
  );
};

export default JobsView;
