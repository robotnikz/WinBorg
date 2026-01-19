// @vitest-environment node


// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  getTimeString,
  getDayKey,
  getTriggerKey,
  shouldTriggerScheduledJob,
  tryStartJob,
  finishJob,
} = require('../../main/scheduler');

describe('main/scheduler', () => {
  test('formats time and day keys', () => {
    const now = new Date('2026-01-13T05:07:00.000Z');
    expect(getDayKey(now)).toBe('2026-01-13');
    // Note: getTimeString uses local time, so we only assert shape
    expect(getTimeString(now)).toMatch(/^\d{2}:\d{2}$/);
  });

  test('daily job triggers only at matching scheduleTime and dedupes by triggerKey', () => {
    const job = { id: 'j1', scheduleEnabled: true, scheduleType: 'daily', scheduleTime: '12:34' };
    const now = new Date();
    now.setHours(12, 34, 0, 0);

    const first = shouldTriggerScheduledJob(job, now, null);
    expect(first.shouldTrigger).toBe(true);
    expect(first.triggerKey).toBe(getTriggerKey(now, 'daily'));

    const second = shouldTriggerScheduledJob(job, now, first.triggerKey);
    expect(second.shouldTrigger).toBe(false);
  });

  test('hourly job triggers only at minute 00 and dedupes by triggerKey', () => {
    const job = { id: 'j2', scheduleEnabled: true, scheduleType: 'hourly' };
    const now = new Date();
    now.setMinutes(0, 0, 0);

    const first = shouldTriggerScheduledJob(job, now, undefined);
    expect(first.shouldTrigger).toBe(true);

    const second = shouldTriggerScheduledJob(job, now, first.triggerKey);
    expect(second.shouldTrigger).toBe(false);

    const notTopOfHour = new Date(now);
    notTopOfHour.setMinutes(1, 0, 0);
    const third = shouldTriggerScheduledJob(job, notTopOfHour, null);
    expect(third.shouldTrigger).toBe(false);
  });

  test('tryStartJob prevents parallel runs and finishJob releases', () => {
    const running = new Set<string>();
    expect(tryStartJob('a', running)).toBe(true);
    expect(tryStartJob('a', running)).toBe(false);
    finishJob('a', running);
    expect(tryStartJob('a', running)).toBe(true);
  });

  test('does not trigger when schedule is disabled or job is missing', () => {
    const now = new Date();
    expect(shouldTriggerScheduledJob(null, now, null)).toEqual({ shouldTrigger: false, triggerKey: null });
    expect(shouldTriggerScheduledJob(undefined, now, null)).toEqual({ shouldTrigger: false, triggerKey: null });

    const disabled = { id: 'j3', scheduleEnabled: false, scheduleType: 'daily', scheduleTime: '00:00' };
    expect(shouldTriggerScheduledJob(disabled, now, null).shouldTrigger).toBe(false);
  });

  test('does not trigger for unknown scheduleType', () => {
    const job = { id: 'j4', scheduleEnabled: true, scheduleType: 'weekly', scheduleTime: '12:34' };
    const now = new Date();
    now.setHours(12, 34, 0, 0);

    const res = shouldTriggerScheduledJob(job, now, null);
    expect(res.shouldTrigger).toBe(false);
    expect(res.triggerKey).toBe(getTriggerKey(now, 'weekly'));
  });
});
