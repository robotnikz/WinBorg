# Testing

WinBorg uses **Vitest** for unit tests and **Playwright** for Electron E2E tests.

For the overall approach and risk mapping, see [docs/TEST_STRATEGY.md](TEST_STRATEGY.md).

## Automated tests

### Local quick start

```bash
npm install
```

### Windows PowerShell note (npm.ps1 blocked)

On some Windows setups, PowerShell script execution is disabled and running `npm` may fail with an error about `npm.ps1` and `Execution_Policies`.

Workarounds (pick one):

1) Use the Windows CMD shim explicitly:

```powershell
npm.cmd run test:pr
```

2) Run npm via Node directly (bypasses PowerShell scripts entirely):

```powershell
node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" run test:pr
```

3) (Optional) Adjust PowerShell execution policy for your user.
Only do this if you understand the security implications:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

```bash
# Typecheck
npm run typecheck

# Unit tests
npm test

# Unit tests with coverage (threshold gated)
npm run test:coverage

# E2E (Playwright launches Electron)
npm run test:e2e

# Fast smoke subset
npm run test:e2e:smoke

# Full E2E suite
npm run test:e2e:full

# Manual E2E (may trigger admin prompts / app close)
npm run test:e2e:manual
```

### PR gate

```bash
npm run test:pr
```

This runs `typecheck` + unit tests (coverage) + E2E smoke.

CI note:
- PRs run the smoke suite.
- Nightly and `main` run the full suite.

### Notes about E2E determinism

- E2E tests run with `NODE_ENV=test` to enable isolated Electron `userData` per run.
- IPC is mocked in E2E so CI does not require real WSL/SSH/Borg.

### Notes about manual E2E

- `test:e2e:manual` is intentionally **not** part of the PR gate.
- `test:e2e` and `test:e2e:full` intentionally **exclude** `@manual` tests by default.
- These tests can click onboarding actions that may lead to UAC prompts and/or app termination on some setups.

## CI/CD pipeline

Tests are executed via GitHub Actions on pushes and pull requests. See `.github/workflows/cicd.yml`.

---

## Manual verification (release-focused)

This test case is designed to verify the experience of a new user on a fresh Windows 11 machine.

**Pre-condition:**
*   Windows 11 (Fresh Install or VM).
*   No WSL installed (or default state).
*   No `borgbackup` installed.

**Steps:**

1.  **Download & Install:**
    *   Download `WinBorg Manager Setup x.x.x.exe`.
    *   Run installer.
    *   **Pass:** App installs and opens Dashboard.

2.  **Verify Setup Validation:**
    *   **Observed Behavior:** If WSL is missing, the app shows "System Setup" modal with instruction to run `wsl --install`.
    *   If WSL is present but Borg is missing, app prompts to install Borg automatically.
    *   **Action:** Click "Install Borg (Auto)" if prompted.
    *   **Pass:** App completes setup and shows checkmark "System Ready!".

3.  **Manual Prerequisites (Only if Auto-Setup fails):**
    *   Open PowerShell as Admin: `wsl --install`.
    *   Reboot.
    
4.  **Functional Test:**
    *   Open WinBorg.
    *   Add a local folder as Repo (e.g., `C:\Backups`).
    *   WinBorg converts this to `/mnt/c/Backups`.
    *   **Pass:** Initialization succeeds.

5.  **Backup Test:**
    *   Create job for `Documents`.
    *   Run Job.
    *   **Pass:** Activity log shows "Success".

## Functional test scenarios

Execute these tests manually to certify a release.

### 4.1 Repository Management

| ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **R1** | **Connect to Repo (Local)** | 1. Click `+` Add Repo.<br>2. Enter path: `C:\TestRepo`.<br>3. Select Encryption: `None`.<br>4. Click "Initialize". | Repository card appears via "Connecting...". Status changes to `Connected`. Statistics (Size/Count) are loaded. |
| **R2** | **Connect to Repo (SSH)** | 1. Click `+` Add Repo.<br>2. Enter URL: `ssh://user@host:22/./backup`.<br>3. Enter Password if requested.<br>4. Click "Add". | App connects via SSH. If host key is unknown, it might prompt or auto-accept (depending on setting). Status becomes `Connected`. |
| **R3** | **Edit Repository** | 1. Click "Edit" (Pencil) on a Repo Card.<br>2. Change Name to `My Renamed Repo`.<br>3. Save. | Repo Card title updates immediately to `My Renamed Repo`. Data persists after restart. |
| **R4** | **Delete Repository** | 1. Click "Trash" icon on Repo Card.<br>2. Confirm "Remove from App". | Repo is removed from UI. **Important:** Actual files on disk must remain untouched. |
| **R5** | **Destroy Repository** | 1. Click "Trash" icon.<br>2. Select "Delete files on disk".<br>3. Type "DELETE". | Repo is removed from UI AND the folder `C:\TestRepo` is gone (or empty). |

### 4.2 Archive Operations

| ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **A1** | **Create Backup** | 1. Open Repo.<br>2. Click "Create Backup".<br>3. Select `My Documents`.<br>4. Run. | Job starts. Spinner active. Activity Log shows `Success`. New archive appears in "Archives" list. |
| **A2** | **Compare Archives (Diff)** | 1. Go to "Archives" view.<br>2. Select Archive A and Archive B.<br>3. Click "Diff Selected". | Modal opens showing file tree. Added files in Green, Deleted in Red, Modified in Yellow. |
| **A3** | **Mount Archive** | 1. On an Archive, click "Mount" (Drive icon).<br>2. Select Letter `Z:`. | Windows Explorer opens `Z:\`. You can browse files. Dashboard shows "Active Mounts: 1". |
| **A4** | **Unmount Archive** | 1. Click "Unmount" on Dashboard or Tray Icon. | Drive `Z:\` disappears. Dashboard "Active Mounts" count returns to 0. |

### 4.3 App Configuration

| ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **S1** | **Change Theme** | 1. Open Settings.<br>2. Toggle "Dark Mode". | UI switches instantly between Light/Dark mode. Setting persists after restart. |
| **S2** | **Notifications** | 1. Settings > Notifications.<br>2. Enter Discord Webhook.<br>3. Click "Test". | Discord receives a "Test Notification" message. |
| **S3** | **General Settings** | 1. Toggle "Start with Windows".<br>2. Restart App. | Registry keys are set (check Task Manager > Startup). |

---

## Release checklist

See [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Supporting docs

- Strategy / approach: [docs/TEST_STRATEGY.md](TEST_STRATEGY.md)
- How to run tests: [docs/TESTING.md](TESTING.md)
- Release checklist: [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- IPC design notes: [docs/IPC.md](IPC.md)
- Architecture overview: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- Operations (day-2): [OPERATIONS.md](../OPERATIONS.md)

Root-level checklists:

- Test plan: [TESTPLAN.md](../TESTPLAN.md)
- Functional test matrix: [FUNCTIONAL_TEST_MATRIX.md](../FUNCTIONAL_TEST_MATRIX.md)
- Compatibility matrix: [COMPATIBILITY.md](../COMPATIBILITY.md)
- Audit notes: [AUDIT.md](../AUDIT.md)
- Security checklist: [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)
- UX checklist: [UX_CHECKLIST.md](../UX_CHECKLIST.md)
