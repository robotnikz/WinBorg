// @vitest-environment node
import { describe, expect, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// JS module used by electron main process
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { atomicWriteFileSync, safeReadJsonWithBackupSync } = require('../../main/persistence');

describe('main/persistence', () => {
  test('atomicWriteFileSync writes file and creates .bak when overwriting', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'data.json');

    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }), 'utf8');
    atomicWriteFileSync(filePath, JSON.stringify({ a: 2 }), { makeBackup: true });

    const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(current).toEqual({ a: 2 });

    const backupPath = `${filePath}.bak`;
    expect(fs.existsSync(backupPath)).toBe(true);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    expect(backup).toEqual({ a: 1 });
  });

  test('safeReadJsonWithBackupSync falls back to .bak on corrupt primary', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'secrets.json');

    fs.writeFileSync(`${filePath}.bak`, JSON.stringify({ secret: 'ok' }), 'utf8');
    fs.writeFileSync(filePath, '{ not valid json', 'utf8');

    const value = safeReadJsonWithBackupSync(filePath, { fallback: true });
    expect(value).toEqual({ secret: 'ok' });

    // best-effort: primary may get renamed to .corrupt-*
    expect(fs.existsSync(`${filePath}.bak`)).toBe(true);
  });

  test('safeReadJsonWithBackupSync returns fallback when both missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'missing.json');

    const value = safeReadJsonWithBackupSync(filePath, { fallback: true });
    expect(value).toEqual({ fallback: true });
  });
});
