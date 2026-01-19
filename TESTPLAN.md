# TESTPLAN (WinBorg)

This is the actionable, risk-based test plan for WinBorg.

WinBorg is an Electron app that orchestrates WSL2 + BorgBackup. The highest risks are:

- Renderer ↔ main IPC drift
- WSL/Borg onboarding reliability across real Windows states
- Persistence & recovery (corruption, partial writes)
- Process orchestration (spawn/stream/cancel)
- Mounting (FUSE requirements, path translation)

## Quick gates

- PR gate: `npm run test:pr`
- Full E2E: `npm run test:e2e:full`
- Manual E2E (may trigger admin prompts / app close): `npm run test:e2e:manual`

Note: `test:e2e` / `test:e2e:full` exclude `@manual` tests by default.

## Test levels

### 1) Unit (Vitest)

Goals:
- Validate pure logic and edge cases fast.

Examples:
- `main/persistence.js` atomic writes + `.bak` recovery
- `main/scheduler.js` trigger/dedupe
- `main/processManager.js` timeouts/kill
- `wsl-helper.js` distro parsing

### 2) Contract / drift tests (Vitest, text-based)

Goals:
- Prevent accidental IPC channel renames or payload drift.

Examples:
- IPC channel presence: `src/test/ipcContract.test.ts`
- IPC payload shape drift: `src/test/ipcPayloadShapes.test.ts`

### 3) E2E (Playwright Electron)

Goals:
- Validate core user journeys.

Determinism:
- E2E runs with `NODE_ENV=test`.
- IPC is mocked so CI does not require real WSL/SSH/Borg.

Smoke scope (`--grep @smoke`):
- App launch
- Onboarding
- Repo flow

Full scope:
- Archives (browse/diff/extract)
- Jobs (create/run/failure)
- Mounts (mount/unmount + UNC translation)
- Settings (import/export, notifications)

## Non-functional requirements (NFR)

This section is intentionally practical: what we measure, how, and how often.

### Stability / soak

- Repeated launch/close loop (manual or scripted): 20 cycles
- Repeated connect/disconnect repo in UI
- Repeated mount/unmount: 10 cycles

Pass criteria:
- No crashes, no leaked background processes, UI remains responsive.

Suggested execution (Windows-friendly):

- Repeat smoke E2E to catch launch/close leaks:
	- `npm run test:e2e:smoke -- --repeat-each=20`
- Repeat a broader subset (when stable enough locally):
	- `npm run test:e2e:full -- --repeat-each=5`

Notes:
- We avoid retries in CI; for soak we use `--repeat-each` instead.
- If a test legitimately triggers app exit (admin/reboot semantics), it belongs in `@manual`.

### Performance

- Repo list with 100 repos (synthetic data)
- Archive list with 500 archives (synthetic data)

Pass criteria:
- View transition < 1s on a mid-range machine
- No long main-thread stalls visible in UI

Suggested execution:

- Run full E2E with trace on failure (local):
	- `npm run test:e2e:full -- --trace=retain-on-failure`
- Use the built-in report to spot slow tests:
	- `npm run test:e2e:full -- --reporter=list`

### Reliability / recovery

- Corrupt `data.json` and verify `.bak` fallback
- Simulate rename failure (Windows) and validate write fallback paths

Pass criteria:
- App remains bootable and state is preserved when `.bak` exists.

Suggested execution:

- Unit-level verification (CI-safe):
	- `npm run test:coverage`
- Manual spot-check (release-focused):
	- Corrupt `data.json` under Electron `userData`, verify boot uses `.bak` (see `OPERATIONS.md`).

### Security / privacy

- Verify passphrases are not logged to console/terminal output
- Verify secrets are stored separately from main DB
- Verify “disable host key check” is explicit and limited in scope

Pass criteria:
- No secrets in logs; unsafe SSH settings require explicit user opt-in.

Suggested execution:

- Review checklist before release:
	- `SECURITY_CHECKLIST.md`
	- `AUDIT.md`

## Manual release certification

See `docs/RELEASE_CHECKLIST.md` for the ship checklist.
