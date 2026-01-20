# FUNCTIONAL_TEST_MATRIX (WinBorg)

This is the practical mapping from **product use-cases** → **risks** → **test coverage**.

Goal: make it obvious where a regression would be caught (unit/contract/E2E) and what remains manual.

## Legend

- **Unit:** Vitest tests for pure logic and isolated helpers.
- **Contract/Drift:** fast, text-based tests to prevent IPC channel/payload drift.
- **E2E Smoke:** deterministic UI wiring checks used in PR gate.
- **E2E Full:** broader deterministic UI coverage (CI nightly/main).
- **Manual E2E:** tests that may trigger admin prompts / app termination and are **opt-in**.

## Coverage matrix

| Use-case / Area | Primary risk | Unit | Contract/Drift | E2E Smoke | E2E Full | Manual E2E |
|---|---|---|---|---|---|---|
| Onboarding (WSL missing / distro missing / borg missing) | First-run breaks across Windows states; IPC drift | `src/test/systemHandlers.test.ts` | `src/test/ipcContract.test.ts`, `src/test/ipcPayloadShapes.test.ts` | `e2e/onboarding.spec.ts` | (covered by onboarding + broader flows) | `e2e/onboarding.manual.spec.ts` |
| Persistence (data/secrets) | Corruption/partial writes prevent boot | `src/test/persistence.test.ts` | (N/A) | (implicit via app boot) | (implicit) | (N/A) |
| Renderer ↔ Main IPC surface | Channel rename/payload drift | (N/A) | `src/test/ipcContract.test.ts`, `src/test/ipcPayloadShapes.test.ts` | (smoke launch) | (all flows) | (N/A) |
| Repo lifecycle (SSH via Connections) | Wrong URL/path handling; SSH remediation regressions | `src/services/borgService.test.ts`, `src/test/sshHelpers.test.ts` | `src/test/ipcContract.test.ts` | `e2e/repositories.spec.ts` | `e2e/repositories.spec.ts` | (optional) |
| Jobs + scheduler | Double-runs; schedule dedupe bugs | `src/test/scheduler.test.ts` | (N/A) | `e2e/jobs.spec.ts` | `e2e/jobs.spec.ts` | (optional) |
| Archives (list/browse/diff/extract) | UI wiring breaks; large-list handling | `src/views/ArchivesView.test.tsx`, `src/components/ArchiveBrowserModal.test.tsx` | (N/A) | (optional subset) | `e2e/archives.spec.ts` | (optional) |
| Mounts (mount/unmount + UNC translation) | Preflight errors; path translation regressions | `src/test/mountPreflight.test.ts`, `src/views/MountsView.test.tsx` | (N/A) | `e2e/mounts.spec.ts` | `e2e/mounts.spec.ts` | (optional) |
| Settings (import/export, notifications, close behavior) | Persistence drift; UI breaks | `src/views/SettingsView.test.tsx` | `src/test/ipcContract.test.ts` | `e2e/settings.spec.ts` | `e2e/settings.spec.ts` | (optional) |
| Updates UI | Modal wiring breaks | `src/components/UpdateModal.test.tsx` | (N/A) | (implicit) | (optional) | (N/A) |

## Running the suites

- PR gate (fast): `npm run test:pr`
- Default E2E (excludes manual): `npm run test:e2e`
- Full E2E (excludes manual): `npm run test:e2e:full`
- Manual E2E (opt-in): `npm run test:e2e:manual`

For details, see `docs/TESTING.md` and `docs/TEST_STRATEGY.md`.
