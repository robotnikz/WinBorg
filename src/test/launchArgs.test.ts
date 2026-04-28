// @vitest-environment node

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getArgValue, getScheduledJobIdFromArgv } = require('../../main/launchArgs');

describe('main/launchArgs', () => {
  test('reads separated CLI flag values', () => {
    expect(getArgValue(['electron', '.', '--run-scheduled-job', 'job-123'], '--run-scheduled-job')).toBe('job-123');
  });

  test('reads inline CLI flag values', () => {
    expect(getArgValue(['electron', '.', '--run-scheduled-job=job-123'], '--run-scheduled-job')).toBe('job-123');
  });

  test('returns null for missing scheduled job id', () => {
    expect(getScheduledJobIdFromArgv(['electron', '.', '--hidden'])).toBeNull();
  });
});