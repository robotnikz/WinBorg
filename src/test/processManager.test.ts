// @vitest-environment node
import { describe, expect, test } from 'vitest';

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
});
