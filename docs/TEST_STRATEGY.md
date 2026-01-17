# Test strategy (risk-based)

This document explains *what* we test, *where*, and *why*.

## Goals

- Find bugs early (fast feedback in PRs).
- Reduce risk in high-impact areas: WSL/Borg orchestration, persistence, IPC drift, scheduler/jobs, mounts.
- Keep tests deterministic: no real WSL, no real SSH, no real Borg execution in CI.
- Preserve app functionality at all times.

## Test pyramid (practical)

### 1) Unit tests (Vitest)

What belongs here:

- Pure logic (scheduler trigger rules, path parsing, formatters)
- Persistence helpers (atomic write, backup recovery)
- Process management logic (tracking, kill flows)
- IPC contract drift tests (string-based / shape-based checks)

Rules:

- No real filesystem writes outside temp fixtures.
- No real WSL/SSH/Borg.
- Mock external calls and keep assertions on outputs and side effects.

### 2) Integration-ish tests (contract/drift)

WinBorg’s biggest failure mode is renderer↔main drift.

We protect against it with tests that:

- Assert key IPC channels are registered in `electron-main.js`.
- Assert renderer calls expected channels with the expected payload shape.

These tests are intentionally simple and fast; they do not require Electron runtime.

### 3) System / E2E tests (Playwright Electron)

What we cover:

- Core user flows: onboarding, repositories, archives, jobs, mounts, settings
- Regression protection for UI wiring and state transitions

How we keep it deterministic:

- Electron is launched by Playwright.
- IPC is mocked/injected in the renderer so we do not require WSL/Borg/SSH.
- `NODE_ENV=test` enables isolated `userData` to keep repeated launches stable.

### 4) Non-functional testing (NFR)

These are risk-based and mostly manual or targeted automation:

- **Stability:** long-running “job schedule” simulation; repeated launch/close; mount/unmount loops.
- **Performance:** large repo list, archive list rendering; diff viewer with large output.
- **Security:** secrets handling (passphrases not logged); host key checks; input validation for paths/URLs.
- **Reliability:** recovery from corrupt `data.json` via `.bak`.

## CI gates

Suggested gates (aligned with repo scripts):

- PR gate (fast): `npm run test:pr`
  - `typecheck` + `test:coverage` + `test:e2e:smoke`
- Nightly / release candidate (broader): `npm run test:e2e:full`

## Coverage mapping (examples)

High-risk areas → primary test types:

- IPC contract: unit (drift) + E2E smoke
- Persistence: unit tests for backup/corruption recovery
- Scheduler/jobs: unit tests for trigger rules + E2E “run now” flow
- Mounts: unit preflight + E2E mount/unmount flow (mocked)
- Onboarding: E2E flow through WSL/Borg missing states

## Manual certification checklist

For release certification, see `docs/RELEASE_CHECKLIST.md` and `docs/TESTING.md`.

Supporting documents:

- `TESTPLAN.md` (actionable plan + NFR checks)
- `FUNCTIONAL_TEST_MATRIX.md` (use-cases → coverage map)
- `COMPATIBILITY.md` (environment matrix)
- `OPERATIONS.md` (day-2 ops)
- `SECURITY_CHECKLIST.md` and `AUDIT.md` (security posture)
- `UX_CHECKLIST.md` (quick UI regression)
