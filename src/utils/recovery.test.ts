import {
  getRecoveryConfidence,
  getRecoveryConfidenceLabel,
  normalizeRecoveryDrillConfig,
  normalizeRecoveryDrillState,
  normalizeRepositoryRecovery,
} from './recovery';
import { Repository } from '../types';

describe('recovery utils', () => {
  test('normalizes recovery drill config and trims sample paths', () => {
    expect(normalizeRecoveryDrillConfig({
      enabled: true,
      autoRunAfterBackup: true,
      samplePaths: ['  Documents/file.txt  ', '', 'Documents/file.txt', 'Pictures/photo.jpg']
    })).toEqual({
      enabled: true,
      autoRunAfterBackup: true,
      samplePaths: ['Documents/file.txt', 'Pictures/photo.jpg']
    });
  });

  test('normalizes recovery drill state defaults', () => {
    expect(normalizeRecoveryDrillState(undefined)).toEqual({
      status: 'idle',
      lastRunAt: 'Never'
    });
  });

  test('normalizes repository recovery fields', () => {
    const repo = normalizeRepositoryRecovery({
      id: 'repo-1',
      name: 'Repo',
      url: 'ssh://user@host/repo',
      lastBackup: 'Never',
      encryption: 'repokey',
      status: 'connected',
      size: 'Unknown',
      fileCount: 0,
    } as Repository);

    expect(repo.recoveryDrill).toEqual({
      enabled: false,
      autoRunAfterBackup: false,
      samplePaths: []
    });
    expect(repo.recoveryDrillState).toEqual({
      status: 'idle',
      lastRunAt: 'Never'
    });
  });

  test('marks recent successful recovery drills as healthy', () => {
    const repo: any = {
      recoveryDrill: { enabled: true, autoRunAfterBackup: false, samplePaths: ['Documents/test.txt'] },
      recoveryDrillState: { status: 'success', lastRunAt: new Date().toISOString(), lastVerifiedCount: 1 }
    };

    expect(getRecoveryConfidence(repo)).toBe('healthy');
    expect(getRecoveryConfidenceLabel(repo)).toBe('Recovery verified (1 path)');
  });

  test('marks failed recovery drills as critical', () => {
    const repo: any = {
      recoveryDrill: { enabled: true, autoRunAfterBackup: true, samplePaths: ['Documents/test.txt'] },
      recoveryDrillState: { status: 'error', lastRunAt: new Date().toISOString(), lastError: 'Permission denied' }
    };

    expect(getRecoveryConfidence(repo)).toBe('critical');
    expect(getRecoveryConfidenceLabel(repo)).toBe('Last recovery drill failed');
  });
});