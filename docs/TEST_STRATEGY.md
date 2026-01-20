# Test strategy (risk-based)

This document explains *what* we test, *where*, and *why*.

## Non-negotiable principles

- Preserve app functionality above all else (regression prevention beats “new coverage”).
- Keep PR feedback fast and deterministic.
- Prefer many small unit/regression tests over large end-to-end scenarios.
- Treat renderer↔main IPC drift as a first-class risk.
- Security is tested like functionality: automated, repeatable, and gated.

## Goals

- Find bugs early (fast feedback in PRs).
- Reduce risk in high-impact areas: WSL/Borg orchestration, persistence, IPC drift, scheduler/jobs, mounts.
- Keep tests deterministic: no real WSL, no real SSH, no real Borg execution in CI.
- Preserve app functionality at all times.

## Test pyramid

Practical target distribution (not a hard rule, but our default posture):

```
                /\
               /  \   E2E (few): key user journeys + smoke
              /____\
             /      \  Integration / contract (some): IPC + persistence + main/renderer seams
            /________\
           /          \  Unit / regression (many): pure logic + parsing + formatting + edge cases
          /____________\
```

Why this shape works for WinBorg:

- WinBorg’s highest risk is orchestration and wiring (IPC, state transitions), not complex algorithms.
- E2E is valuable but expensive/flaky if it depends on OS/WSL/SSH. We mock IPC so E2E stays deterministic.
- Unit/regression tests are the best “blast radius reducer” when refactoring.

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

What “regression tests” mean in this repo:

- Any test that guards a previously-fixed bug or a known failure mode (parsing, queueing, IPC channel name drift).
- These tests should be tiny, explicit, and stable.

### 2) Integration-ish tests (contract/drift)

WinBorg’s biggest failure mode is renderer↔main drift.

We protect against it with tests that:

- Assert key IPC channels are registered in `electron-main.js`.
- Assert renderer calls expected channels with the expected payload shape.

These tests are intentionally simple and fast; they do not require Electron runtime.

Examples:

- IPC channel allowlist (security-critical channels must exist in main and be referenced by the renderer)
- IPC payload shape checks (renderer emits what main expects)
- Persistence format drift checks (saved DB schema changes are backwards compatible)

### 3) System / E2E tests (Playwright Electron)

What we cover:

- Core user flows: onboarding, repositories, archives, jobs, mounts, settings
- Regression protection for UI wiring and state transitions

How we keep it deterministic:

- Electron is launched by Playwright.
- IPC is mocked/injected in the renderer so we do not require WSL/Borg/SSH.
- `NODE_ENV=test` enables isolated `userData` to keep repeated launches stable.

Suite taxonomy:

- `@smoke`: minimal PR gate set (fast, high-signal). Keep small.
- (untagged): full deterministic E2E suite for nightly / main.
- `@manual`: anything that can trigger UAC prompts, reboot, real network/WSL dependencies.

### 4) Non-functional testing (NFR)

These are risk-based and mostly manual or targeted automation:

- **Stability:** long-running “job schedule” simulation; repeated launch/close; mount/unmount loops.
- **Performance:** large repo list, archive list rendering; diff viewer with large output.
- **Security:** secrets handling (passphrases not logged); host key checks; input validation for paths/URLs.
- **Reliability:** recovery from corrupt `data.json` via `.bak`.

## Security testing (automated)

WinBorg is a desktop app that orchestrates:

- privileged OS actions (WSL enable/install, reboot triggers)
- sensitive data (repo URLs, potentially passphrases, exported settings)
- remote connectivity (SSH)

Automated security checks we rely on:

- Dependency review on PRs (block known vulnerable dependencies in a PR before merge).
- `npm audit` for production dependencies (block high/critical runtime vulnerabilities).
- CodeQL (SAST) on main/PRs (JavaScript/TypeScript analysis).
- IPC contract tests: ensure security-critical channels remain registered and referenced.

Scope note: we do not attempt “penetration testing” in CI; we focus on repeatable SAST + supply-chain + regression guards.

## CI gates

Suggested gates (aligned with repo scripts):

- PR gate (fast): `npm run test:pr`
  - `typecheck` + `test:coverage` + `test:e2e:smoke`
- Nightly / release candidate (broader): `npm run test:e2e:full`

Recommended security gates in CI:

- PRs:
  - dependency review (GitHub Action)
  - production dependency audit (`npm audit --omit=dev --audit-level=high`)
- main/nightly:
  - full E2E suite
  - CodeQL scheduled scan

## Coverage mapping (examples)

High-risk areas → primary test types:

- IPC contract: unit (drift) + E2E smoke
- Persistence: unit tests for backup/corruption recovery
- Scheduler/jobs: unit tests for trigger rules + E2E “run now” flow
- Mounts: unit preflight + E2E mount/unmount flow (mocked)
- Onboarding: E2E flow through WSL/Borg missing states

## Coverage mapping (core user journeys)

These are the “must not break” workflows. The goal is to keep them protected primarily by deterministic unit/regression + App-seam integration tests, and only a small smoke layer in Playwright.

- Add repository + connect (happy path)
  - `src/views/RepositoriesView.test.tsx` (modal validation + “Test SSH & Remote Connection” → “Connect”)
  - `src/App.connect.integration.test.tsx` (App handler parses `borg list --json`, marks repo Online, populates archives)
- Repo actions wiring (UI → handler)
  - `src/components/RepoCard.test.tsx` (Unlock/Edit/Jobs/One-off backup callbacks)
  - `src/views/RepositoriesView.integration.test.tsx` (RepoCard buttons open the correct modals)
- Repo unlock (break-lock + lock badge clears)
  - `src/App.unlock.integration.test.tsx` (forces unlock, deletes lock files, refreshes lock state)
- Archives refresh/browse/restore/diff
  - `src/views/ArchivesView.test.tsx` (restore success modal + diff failure modes)
  - Contract guards: `src/test/ipcContract.test.ts`, `src/test/e2eMockContract.test.ts`
- Mount + Unmount
  - `src/views/MountsView.test.tsx` (mount/unmount wiring + path sanitization)
  - `src/App.mount.integration.test.tsx` (mount success triggers `open-path` and adds mount entry)

## Manual certification checklist

For release certification, see [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and [docs/TESTING.md](TESTING.md).

Supporting documents:

- [docs/TESTING.md](TESTING.md) (how to run unit/E2E locally + troubleshooting)
- [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) (manual certification steps)
- [docs/IPC.md](IPC.md) (IPC channel documentation and design notes)
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) (high-level architecture)
- [OPERATIONS.md](OPERATIONS.md) (day-2 ops)

Additional checklists:

- [TESTPLAN.md](TESTPLAN.md) (actionable plan + NFR checks)
- [FUNCTIONAL_TEST_MATRIX.md](FUNCTIONAL_TEST_MATRIX.md) (use-cases → coverage map)
- [COMPATIBILITY.md](COMPATIBILITY.md) (environment matrix)
- [AUDIT.md](AUDIT.md) (audit notes / security posture)
- [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) (security checklist)
- [UX_CHECKLIST.md](UX_CHECKLIST.md) (quick UI regression)
