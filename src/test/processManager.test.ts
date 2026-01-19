// @vitest-environment node

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createProcessManager } = require('../../main/processManager');

describe('main/processManager', () => {
  test('spawnCapture captures stdout and exits 0', async () => {
    const pm = createProcessManager({ updatePowerBlocker: () => {}, processMap: new Map() });
    const res = await pm.spawnCapture('node', ['-e', "process.stdout.write('hello')"]);
    expect(res.timedOut).toBe(false);
    expect(res.error).toBe(null);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('hello');
  });

  test('spawnCapture captures stderr', async () => {
    const pm = createProcessManager({ updatePowerBlocker: () => {}, processMap: new Map() });
    const res = await pm.spawnCapture('node', ['-e', "process.stderr.write('oops')"]);
    expect(res.timedOut).toBe(false);
    expect(res.error).toBe(null);
    expect(res.code).toBe(0);
    expect(res.stderr).toContain('oops');
  });

  test('spawnCapture supports stdin piping', async () => {
    const pm = createProcessManager({ updatePowerBlocker: () => {}, processMap: new Map() });
    const script = [
      "process.stdin.setEncoding('utf8');",
      "let data='';",
      "process.stdin.on('data', c => data += c);",
      "process.stdin.on('end', () => { process.stdout.write(data); });",
    ].join(' ');
    const res = await pm.spawnCapture('node', ['-e', script], { stdin: 'abc' });
    expect(res.timedOut).toBe(false);
    expect(res.error).toBe(null);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('abc');
  });

  test('spawnCapture times out and reports timedOut=true', async () => {
    const pm = createProcessManager({ updatePowerBlocker: () => {}, processMap: new Map() });
    const res = await pm.spawnCapture('node', ['-e', "setTimeout(() => {}, 5000)"], { timeoutMs: 100 });
    expect(res.timedOut).toBe(true);
    expect(res.code).toBe(null);
    expect(String(res.error || '')).toMatch(/timeout/i);
  });

  test('registerManagedChild times out, kills child, and removes from map', async () => {
    vi.useFakeTimers();

    const updatePowerBlocker = vi.fn();
    const map = new Map();
    const pm = createProcessManager({ updatePowerBlocker, processMap: map });

    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();

    const onError = vi.fn();
    const onExit = vi.fn();

    pm.registerManagedChild({
      map,
      id: 't1',
      child,
      kind: 'process',
      timeoutMs: 50,
      onExit,
      onError,
    });

    expect(map.has('t1')).toBe(true);

    await vi.advanceTimersByTimeAsync(60);

    expect(map.has('t1')).toBe(false);
    expect(child.kill).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0]?.message || '')).toMatch(/timeout/i);
    expect(onError.mock.calls[0][1]).toEqual(expect.objectContaining({ timedOut: true }));
    expect(updatePowerBlocker).toHaveBeenCalled();
  });

  test('registerManagedChild stop() kills child and removes from map once', () => {
    const updatePowerBlocker = vi.fn();
    const map = new Map();
    const pm = createProcessManager({ updatePowerBlocker, processMap: map });

    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();

    const reg = pm.registerManagedChild({
      map,
      id: 't2',
      child,
      kind: 'process',
      timeoutMs: 10_000,
    });

    expect(map.has('t2')).toBe(true);
    reg.stop();
    expect(map.has('t2')).toBe(false);
    expect(child.kill).toHaveBeenCalledTimes(1);

    // should be idempotent
    reg.stop();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  test('stopTrackedProcessEntry calls kill() on placeholder objects', () => {
    const pm = createProcessManager({ updatePowerBlocker: () => {}, processMap: new Map() });
    const entry = { kill: vi.fn() };
    pm.stopTrackedProcessEntry(entry);
    expect(entry.kill).toHaveBeenCalledTimes(1);
  });
});
