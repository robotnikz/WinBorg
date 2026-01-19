// @vitest-environment node

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('wsl-helper getPreferredWslDistro', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when exec returns an error', async () => {
    const childProcess = require('child_process');
    const execFileSpy = vi
      .spyOn(childProcess, 'execFile')
      .mockImplementation((_file: any, _args: any, _opts: any, cb: any) => cb(new Error('no wsl'), ''));

    try {
      const wslHelper = require('../../wsl-helper');
      const res = await wslHelper.getPreferredWslDistro();

      expect(res).toBeNull();
      expect(execFileSpy).toHaveBeenCalledWith(
        'wsl',
        ['--list'],
        expect.objectContaining({ encoding: 'utf16le' }),
        expect.any(Function),
      );
    } finally {
      execFileSpy.mockRestore();
    }
  });

  it('returns parsed distro when exec succeeds', async () => {
    const childProcess = require('child_process');
    const execFileSpy = vi
      .spyOn(childProcess, 'execFile')
      .mockImplementation((_file: any, _args: any, _opts: any, cb: any) =>
        cb(null, '\uFEFFWindows Subsystem for Linux Distributions:\nUbuntu-24.04 (Default)\n'),
      );

    try {
      const wslHelper = require('../../wsl-helper');
      const res = await wslHelper.getPreferredWslDistro();

      expect(res).toBe('Ubuntu-24.04');
    } finally {
      execFileSpy.mockRestore();
    }
  });
});
