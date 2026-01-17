// @vitest-environment node

import { describe, it, expect } from 'vitest';

import fs from 'node:fs';
import path from 'node:path';

/**
 * Integration-ish IPC payload shape contract.
 *
 * Goal: Catch accidental changes to handler parameter shapes that would
 * compile but break at runtime (renderer/main mismatch).
 *
 * We keep this test text-based (regex) so it doesn't require importing
 * Electron main code into the unit-test environment.
 */

describe('IPC payload shapes (renderer <-> main)', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const electronMainPath = path.join(repoRoot, 'electron-main.js');
  const borgServicePath = path.join(repoRoot, 'src', 'services', 'borgService.ts');
  const appPath = path.join(repoRoot, 'src', 'App.tsx');
  const onboardingModalPath = path.join(repoRoot, 'src', 'components', 'OnboardingModal.tsx');

  it('borg-mount and borg-unmount handler signatures contain expected keys', () => {
    const text = fs.readFileSync(electronMainPath, 'utf8');

    // borg-mount: destructured payload with these keys
    expect(
      /ipcMain\.handle\(\s*['"]borg-mount['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\bargs\b[^}]*\bmountId\b[^}]*\buseWsl\b[^}]*\bexecutablePath\b[^}]*\benvVars\b[^}]*\brepoId\b[^}]*\}\s*\)\s*=>/m.test(
        text
      ),
      'Expected borg-mount handler to destructure args/mountId/useWsl/executablePath/envVars/repoId'
    ).toBe(true);

    // borg-unmount: destructured payload with these keys
    expect(
      /ipcMain\.handle\(\s*['"]borg-unmount['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\bmountId\b[^}]*\blocalPath\b[^}]*\buseWsl\b[^}]*\bexecutablePath\b[^}]*\}\s*\)\s*=>/m.test(
        text
      ),
      'Expected borg-unmount handler to destructure mountId/localPath/useWsl/executablePath'
    ).toBe(true);
  });

  it('borg-stop handler signature expects { commandId } and borgService passes it', () => {
    const mainText = fs.readFileSync(electronMainPath, 'utf8');
    const rendererText = fs.readFileSync(borgServicePath, 'utf8');

    expect(
      /ipcMain\.handle\(\s*['"]borg-stop['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\bcommandId\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected borg-stop handler to destructure commandId'
    ).toBe(true);

    expect(
      /ipcRenderer\.invoke\(\s*['"]borg-stop['"]\s*,\s*\{\s*commandId\s*\}\s*\)/m.test(rendererText),
      'Expected borgService.stopCommand to invoke borg-stop with { commandId }'
    ).toBe(true);
  });

  it('borg-spawn handler destructures expected keys and borgService uses matching payload keys', () => {
    const mainText = fs.readFileSync(electronMainPath, 'utf8');
    const rendererText = fs.readFileSync(borgServicePath, 'utf8');

    expect(
      /ipcMain\.handle\(\s*['"]borg-spawn['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\bargs\b[^}]*\bcommandId\b[^}]*\buseWsl\b[^}]*\bexecutablePath\b[^}]*\benvVars\b[^}]*\bforceBinary\b[^}]*\brepoId\b[^}]*\bcwd\b[^}]*\bwslUser\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected borg-spawn handler to destructure args/commandId/useWsl/executablePath/envVars/forceBinary/repoId/cwd/wslUser'
    ).toBe(true);

    // runCommand path uses executablePath/envVars and may pass repoId/cwd overrides
    expect(
      /ipcRenderer\.invoke\(\s*['"]borg-spawn['"]\s*,\s*\{[^}]*\bargs\b[^}]*\bcommandId\b[^}]*\buseWsl\b[^}]*\bexecutablePath\b[^}]*\benvVars\b[^}]*\bforceBinary\b[^}]*\brepoId\b[^}]*\bcwd\b[^}]*\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.runCommand to invoke borg-spawn with args/commandId/useWsl/executablePath/envVars/forceBinary/repoId/cwd'
    ).toBe(true);

    // ensureFuseConfig path uses wslUser=\"root\" and forceBinary=\"bash\"
    expect(
      /ipcRenderer\.invoke\(\s*['"]borg-spawn['"]\s*,\s*\{[\s\S]*?\bcommandId\b[\s\S]*?\buseWsl\b[\s\S]*?\benvVars\b[\s\S]*?\bforceBinary\b[\s\S]*?\bwslUser\b[\s\S]*?\bargs\b[\s\S]*?\}/m.test(
        rendererText
      ),
      'Expected borgService.ensureFuseConfig to invoke borg-spawn with commandId/useWsl/envVars/forceBinary/wslUser/args'
    ).toBe(true);
  });

  it('filesystem helpers match: get-downloads-path returns string, create-directory takes path arg, select-directory has no args', () => {
    const mainText = fs.readFileSync(electronMainPath, 'utf8');
    const rendererText = fs.readFileSync(borgServicePath, 'utf8');

    // get-downloads-path: handler with no payload, returns app.getPath('downloads')
    expect(
      /ipcMain\.handle\(\s*['"]get-downloads-path['"]\s*,\s*\(\s*\)\s*=>\s*app\.getPath\(\s*['"]downloads['"]\s*\)\s*\)/m.test(
        mainText
      ),
      'Expected get-downloads-path handler to return app.getPath("downloads")'
    ).toBe(true);

    // create-directory: handler receives dirPath as 2nd arg
    expect(
      /ipcMain\.handle\(\s*['"]create-directory['"]\s*,\s*async\s*\(\s*event\s*,\s*dirPath\s*\)\s*=>/m.test(mainText),
      'Expected create-directory handler to be (event, dirPath)'
    ).toBe(true);

    // select-directory: handler takes no args (dialog is opened in main)
    expect(
      /ipcMain\.handle\(\s*['"]select-directory['"]\s*,\s*async\s*\(\s*\)\s*=>/m.test(mainText),
      'Expected select-directory handler to be async () =>'
    ).toBe(true);

    // renderer usage
    expect(
      /ipcRenderer\.invoke\(\s*['"]get-downloads-path['"]\s*\)/m.test(rendererText),
      'Expected borgService.getDownloadsPath to invoke get-downloads-path'
    ).toBe(true);

    expect(
      /ipcRenderer\.invoke\(\s*['"]create-directory['"]\s*,\s*path\s*\)/m.test(rendererText),
      'Expected borgService.createDirectory to invoke create-directory with a path argument'
    ).toBe(true);

    expect(
      /ipcRenderer\.invoke\(\s*['"]select-directory['"]\s*\)/m.test(rendererText),
      'Expected borgService.selectDirectory to invoke select-directory without args'
    ).toBe(true);
  });

  it('SSH handlers destructure expected keys and borgService passes matching payload keys', () => {
    const mainText = fs.readFileSync(electronMainPath, 'utf8');
    const rendererText = fs.readFileSync(borgServicePath, 'utf8');

    // ssh-key-manage: { action, type }
    expect(
      /ipcMain\.handle\(\s*['"]ssh-key-manage['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\baction\b[^}]*\btype\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected ssh-key-manage handler to destructure action/type'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]ssh-key-manage['"]\s*,\s*\{[\s\S]*?\baction\b[\s\S]*?\btype\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.manageSSHKey to invoke ssh-key-manage with action/type'
    ).toBe(true);

    // ssh-key-install: { target, password, port }
    expect(
      /ipcMain\.handle\(\s*['"]ssh-key-install['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\btarget\b[^}]*\bpassword\b[^}]*\bport\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected ssh-key-install handler to destructure target/password/port'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]ssh-key-install['"]\s*,\s*\{[\s\S]*?\btarget\b[\s\S]*?\bpassword\b[\s\S]*?\bport\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.installSSHKey to invoke ssh-key-install with target/password/port'
    ).toBe(true);

    // ssh-install-borg: { target, password, port }
    expect(
      /ipcMain\.handle\(\s*['"]ssh-install-borg['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\btarget\b[^}]*\bpassword\b[^}]*\bport\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected ssh-install-borg handler to destructure target/password/port'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]ssh-install-borg['"]\s*,\s*\{[\s\S]*?\btarget\b[\s\S]*?\bpassword\b[\s\S]*?\bport\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.installBorg to invoke ssh-install-borg with target/password/port'
    ).toBe(true);

    // ssh-test-connection: { target, port }
    expect(
      /ipcMain\.handle\(\s*['"]ssh-test-connection['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\btarget\b[^}]*\bport\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected ssh-test-connection handler to destructure target/port'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]ssh-test-connection['"]\s*,\s*\{[\s\S]*?\btarget\b[\s\S]*?\bport\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.testSshConnection to invoke ssh-test-connection with target/port'
    ).toBe(true);

    // ssh-check-borg: { target, port }
    expect(
      /ipcMain\.handle\(\s*['"]ssh-check-borg['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\btarget\b[^}]*\bport\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected ssh-check-borg handler to destructure target/port'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]ssh-check-borg['"]\s*,\s*\{[\s\S]*?\btarget\b[\s\S]*?\bport\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.checkBorgInstalledRemote to invoke ssh-check-borg with target/port'
    ).toBe(true);
  });

  it('Secret handlers destructure expected keys and borgService passes matching payload keys', () => {
    const mainText = fs.readFileSync(electronMainPath, 'utf8');
    const rendererText = fs.readFileSync(borgServicePath, 'utf8');

    expect(
      /ipcMain\.handle\(\s*['"]save-secret['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\brepoId\b[^}]*\bpassphrase\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected save-secret handler to destructure repoId/passphrase'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]save-secret['"]\s*,\s*\{[\s\S]*?\brepoId\b[\s\S]*?\bpassphrase\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.savePassphrase to invoke save-secret with repoId/passphrase'
    ).toBe(true);

    expect(
      /ipcMain\.handle\(\s*['"]delete-secret['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\brepoId\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected delete-secret handler to destructure repoId'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]delete-secret['"]\s*,\s*\{[\s\S]*?\brepoId\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.deletePassphrase to invoke delete-secret with repoId'
    ).toBe(true);

    // has-secret is a single-line arrow in electron-main.js
    expect(
      /ipcMain\.handle\(\s*['"]has-secret['"]\s*,\s*async\s*\(\s*event\s*,\s*\{[^}]*\brepoId\b[^}]*\}\s*\)\s*=>/m.test(
        mainText
      ),
      'Expected has-secret handler to destructure repoId'
    ).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*['"]has-secret['"]\s*,\s*\{[\s\S]*?\brepoId\b[\s\S]*?\}\s*\)/m.test(
        rendererText
      ),
      'Expected borgService.hasPassphrase to invoke has-secret with repoId'
    ).toBe(true);
  });

  it('system check/install handlers are registered and renderer invokes them with no payload', () => {
    const mainText = fs.readFileSync(electronMainPath, 'utf8');
    const appText = fs.readFileSync(appPath, 'utf8');
    const onboardingText = fs.readFileSync(onboardingModalPath, 'utf8');

    // electron-main.js registers these as direct handler references (no payload expected)
    for (const channel of [
      'system-check-wsl',
      'system-install-wsl',
      'system-install-ubuntu',
      'system-check-borg',
      'system-install-borg',
      'system-fix-wsl-fuse',
      'system-reboot',
    ]) {
      expect(
        new RegExp(`ipcMain\\.handle\\(\\s*['\"]${channel}['\"]\\s*,`, 'm').test(mainText),
        `Expected electron-main.js to register ipcMain.handle("${channel}")`
      ).toBe(true);
    }

    // App.tsx performs early system checks with no args
    expect(/ipcRenderer\.invoke\(\s*['"]system-check-wsl['"]\s*\)/m.test(appText)).toBe(true);
    expect(/ipcRenderer\.invoke\(\s*['"]system-check-borg['"]\s*\)/m.test(appText)).toBe(true);

    // OnboardingModal checks and installs; install WSL vs Ubuntu uses a ternary to pick channel
    expect(/ipcRenderer\.invoke\(\s*['"]system-check-wsl['"]\s*\)/m.test(onboardingText)).toBe(true);
    expect(/ipcRenderer\.invoke\(\s*['"]system-check-borg['"]\s*\)/m.test(onboardingText)).toBe(true);
    expect(/ipcRenderer\.invoke\(\s*['"]system-install-borg['"]\s*\)/m.test(onboardingText)).toBe(true);
    expect(
      /ipcRenderer\.invoke\(\s*wslAction\s*===\s*['"]install-ubuntu['"]\s*\?\s*['"]system-install-ubuntu['"]\s*:\s*['"]system-install-wsl['"]\s*\)/m.test(
        onboardingText
      ),
      'Expected OnboardingModal to choose between system-install-ubuntu and system-install-wsl via ternary'
    ).toBe(true);
  });
});
