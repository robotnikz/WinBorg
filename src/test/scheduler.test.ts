// @vitest-environment node


// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  getTimeString,
  getDayKey,
  getTriggerKey,
  isWithinActiveScheduleWindow,
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

  test('daily job catches up once after startup when the scheduled minute was missed', () => {
    const job = {
      id: 'j-catchup',
      scheduleEnabled: true,
      scheduleType: 'daily',
      scheduleTime: '02:00',
      lastRun: 'Never'
    };
    const now = new Date();
    now.setHours(2, 5, 0, 0);

    const res = shouldTriggerScheduledJob(job, now, null, { lastRunAt: job.lastRun, allowCatchUp: true });
    expect(res.shouldTrigger).toBe(true);
    expect(res.mode).toBe('catch-up');
    expect(res.triggerKey).toBe(getTriggerKey(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0, 0), 'daily'));
  });

  test('does not catch up a slot that already ran', () => {
    const job = {
      id: 'j-catchup-done',
      scheduleEnabled: true,
      scheduleType: 'daily',
      scheduleTime: '02:00'
    };
    const now = new Date('2026-01-13T02:05:00');

    const res = shouldTriggerScheduledJob(job, now, null, {
      lastRunAt: '2026-01-13T02:03:00.000Z',
      allowCatchUp: true
    });
    expect(res.shouldTrigger).toBe(false);
  });

  test('hourly job triggers only at minute 00 and dedupes by triggerKey', () => {
    const job = { id: 'j2', scheduleEnabled: true, scheduleType: 'hourly' };
    const now = new Date();
    now.setMinutes(0, 0, 0);

    const first = shouldTriggerScheduledJob(job, now, undefined, { allowCatchUp: false });
    expect(first.shouldTrigger).toBe(true);

    const second = shouldTriggerScheduledJob(job, now, first.triggerKey, { allowCatchUp: false });
    expect(second.shouldTrigger).toBe(false);

    const notTopOfHour = new Date(now);
    notTopOfHour.setMinutes(1, 0, 0);
    const third = shouldTriggerScheduledJob(job, notTopOfHour, null, { allowCatchUp: false });
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
    expect(res.triggerKey).toBe(null);
  });

  test('respects active schedule windows, including overnight windows', () => {
    const midday = new Date('2026-01-13T12:30:00');
    expect(isWithinActiveScheduleWindow(midday, {
      scheduleEnabled: true,
      scheduleStart: '08:00',
      scheduleEnd: '18:00'
    })).toBe(true);

    expect(isWithinActiveScheduleWindow(midday, {
      scheduleEnabled: true,
      scheduleStart: '18:00',
      scheduleEnd: '08:00'
    })).toBe(false);

    const lateNight = new Date('2026-01-13T23:30:00');
    expect(isWithinActiveScheduleWindow(lateNight, {
      scheduleEnabled: true,
      scheduleStart: '22:00',
      scheduleEnd: '06:00'
    })).toBe(true);
  });

  test('does not trigger outside the active schedule window', () => {
    const job = { id: 'j5', scheduleEnabled: true, scheduleType: 'hourly' };
    const now = new Date('2026-01-13T12:00:00');

    const res = shouldTriggerScheduledJob(job, now, null, {
      scheduleWindow: {
        scheduleEnabled: true,
        scheduleStart: '13:00',
        scheduleEnd: '18:00'
      }
    });

    expect(res.shouldTrigger).toBe(false);
  });
});
