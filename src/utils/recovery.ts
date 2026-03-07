import { RecoveryDrillConfig, RecoveryDrillState, Repository } from '../types';

export type RecoveryConfidence = 'unknown' | 'healthy' | 'warning' | 'critical';

const DEFAULT_RECOVERY_DRILL_CONFIG: RecoveryDrillConfig = {
  enabled: false,
  autoRunAfterBackup: false,
  samplePaths: [],
};

const DEFAULT_RECOVERY_DRILL_STATE: RecoveryDrillState = {
  status: 'idle',
  lastRunAt: 'Never',
};

export const normalizeRecoveryDrillConfig = (
  value?: Partial<RecoveryDrillConfig> | null
): RecoveryDrillConfig => {
  const rawPaths = Array.isArray(value?.samplePaths) ? value?.samplePaths : [];
  const samplePaths = Array.from(new Set(rawPaths.map((entry) => String(entry).trim()).filter(Boolean)));

  return {
    enabled: value?.enabled === true,
    autoRunAfterBackup: value?.autoRunAfterBackup === true,
    samplePaths,
  };
};

export const normalizeRecoveryDrillState = (
  value?: Partial<RecoveryDrillState> | null
): RecoveryDrillState => {
  return {
    ...DEFAULT_RECOVERY_DRILL_STATE,
    ...(value || {}),
    status: value?.status || 'idle',
    lastRunAt: value?.lastRunAt || 'Never',
  };
};

export const normalizeRepositoryRecovery = <T extends Repository>(repo: T): T => {
  return {
    ...repo,
    recoveryDrill: normalizeRecoveryDrillConfig(repo.recoveryDrill),
    recoveryDrillState: normalizeRecoveryDrillState(repo.recoveryDrillState),
  };
};

const parseRunDate = (value?: string) => {
  if (!value || value === 'Never') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getRecoveryConfidence = (repo: Repository): RecoveryConfidence => {
  const config = normalizeRecoveryDrillConfig(repo.recoveryDrill);
  const state = normalizeRecoveryDrillState(repo.recoveryDrillState);

  if (!config.enabled || config.samplePaths.length === 0) return 'unknown';
  if (state.status === 'running') return 'warning';
  if (state.status === 'error') return 'critical';

  const lastRunAt = parseRunDate(state.lastRunAt);
  if (!lastRunAt) return 'warning';

  const ageDays = (Date.now() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 14) return 'healthy';
  if (ageDays <= 30) return 'warning';
  return 'critical';
};

export const getRecoveryConfidenceLabel = (repo: Repository): string => {
  const config = normalizeRecoveryDrillConfig(repo.recoveryDrill);
  const state = normalizeRecoveryDrillState(repo.recoveryDrillState);

  if (!config.enabled || config.samplePaths.length === 0) return 'Recovery drill not configured';
  if (state.status === 'running') return 'Recovery drill running';
  if (state.status === 'error') return 'Last recovery drill failed';
  if (!state.lastRunAt || state.lastRunAt === 'Never') return 'Recovery drill pending';

  const count = typeof state.lastVerifiedCount === 'number' ? state.lastVerifiedCount : config.samplePaths.length;
  return `Recovery verified (${count} path${count === 1 ? '' : 's'})`;
};