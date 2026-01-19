// @vitest-environment node

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

  test('atomicWriteFileSync does not create .bak when makeBackup=false', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'data.json');

    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }), 'utf8');
    atomicWriteFileSync(filePath, JSON.stringify({ a: 2 }), { makeBackup: false });

    const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(current).toEqual({ a: 2 });

    expect(fs.existsSync(`${filePath}.bak`)).toBe(false);
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

  test('safeReadJsonWithBackupSync renames corrupt primary when backup is used', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'secrets.json');

    fs.writeFileSync(`${filePath}.bak`, JSON.stringify({ ok: true }), 'utf8');
    fs.writeFileSync(filePath, '{ not valid json', 'utf8');

    const value = safeReadJsonWithBackupSync(filePath, { fallback: true });
    expect(value).toEqual({ ok: true });

    const files = fs.readdirSync(dir);
    const corruptPrefix = 'secrets.json.corrupt-';
    expect(files.some((f) => f.startsWith(corruptPrefix))).toBe(true);
  });

  test('safeReadJsonWithBackupSync falls back to .bak on empty primary', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'secrets.json');

    fs.writeFileSync(`${filePath}.bak`, JSON.stringify({ secret: 'ok' }), 'utf8');
    fs.writeFileSync(filePath, '   \n', 'utf8');

    const value = safeReadJsonWithBackupSync(filePath, { fallback: true });
    expect(value).toEqual({ secret: 'ok' });
  });

  test('safeReadJsonWithBackupSync returns fallback when both missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'missing.json');

    const value = safeReadJsonWithBackupSync(filePath, { fallback: true });
    expect(value).toEqual({ fallback: true });
  });

  test('atomicWriteFileSync falls back to delete+rename when rename fails once', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'data.json');

    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }), 'utf8');

    const originalRenameSync = fs.renameSync.bind(fs);
    let firstAttempt = true;
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((src, dest) => {
      // Simulate Windows-style rename overwrite failure on the first attempt.
      if (dest === filePath && firstAttempt) {
        firstAttempt = false;
        throw new Error('EPERM: simulated rename failure');
      }
      return originalRenameSync(src as any, dest as any);
    });
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync');

    try {
      atomicWriteFileSync(filePath, JSON.stringify({ a: 2 }), { makeBackup: false });
      expect(unlinkSpy).toHaveBeenCalled();
      const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(current).toEqual({ a: 2 });
    } finally {
      renameSpy.mockRestore();
      unlinkSpy.mockRestore();
    }
  });

  test('atomicWriteFileSync falls back to copy+cleanup when rename fails twice', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winborg-persist-'));
    const filePath = path.join(dir, 'data.json');

    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }), 'utf8');

    const originalRenameSync = fs.renameSync.bind(fs);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((src, dest) => {
      if (dest === filePath) throw new Error('EPERM: simulated rename failure');
      return originalRenameSync(src as any, dest as any);
    });
    const copySpy = vi.spyOn(fs, 'copyFileSync');

    try {
      atomicWriteFileSync(filePath, JSON.stringify({ a: 3 }), { makeBackup: false });
      expect(copySpy).toHaveBeenCalled();
      const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(current).toEqual({ a: 3 });
    } finally {
      renameSpy.mockRestore();
      copySpy.mockRestore();
    }
  });
});
