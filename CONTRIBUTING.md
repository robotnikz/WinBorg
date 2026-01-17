# Contributing

Thanks for your interest in contributing to WinBorg.

## Before you start
- Please read the project overview and user-facing behavior in `README.md`.
- For bug reports and feature ideas, prefer opening an issue (GitHub issue templates are provided).

## Quick start

### Prereqs
- Node.js
  - For day-to-day development + tests, use the Node version from the **test** job in `.github/workflows/cicd.yml` (currently Node 20).
  - For release automation, note the **release** job uses a newer Node version (currently Node 22) due to `semantic-release` requirements.
- Git

### Install
```bash
npm ci
```

### Run (Renderer only)
```bash
npm run dev
```

### Run (Electron dev)
```bash
npm run electron:dev
```

### Build
```bash
npm run build
```

### Unit tests
```bash
npm test
# CI mode
npx vitest run
```

### PR gate (recommended before opening a PR)
```bash
npm run test:pr
```

### E2E tests (Electron)
```bash
npm run test:e2e

# Fast subset used in PR gate
npm run test:e2e:smoke

# Full suite (recommended before releases)
npm run test:e2e:full

# Manual suite (may trigger admin prompts / app close)
npm run test:e2e:manual
```

## Branching & PRs
- Default branch: `main`
- Prefer small, focused PRs.
- For dependency upgrades, keep changes scoped and avoid mixing unrelated refactors.

### Recommended workflow
- External contributors: fork the repo, create a feature branch, then open a PR targeting `main`.
- Maintainers with write access: create a feature branch in-repo, then open a PR targeting `main`.

## Commit messages
This repo uses semantic-release. Please follow Conventional Commits:
- `feat: ...`
- `fix: ...`
- `chore: ...`
- `docs: ...`
- `test: ...`

## Security-sensitive areas
Please be extra careful when touching:
- WSL installation logic
- Borg installation and invocation
- SSH key management and deployment

Changes here should include:
- Unit tests for the affected logic (or updates to existing tests)
- Clear PR notes about risk and how it was tested

## IPC contract
Renderer <-> Main communication is based on IPC channel names.
There is a minimal contract test that ensures key channels remain consistent.
If you rename an IPC channel, update both sides and the test in `src/test/ipcContract.test.ts`.

## More documentation

Start at [docs/README.md](docs/README.md).

Additional supporting docs:
- `TESTPLAN.md` (actionable plan)
- `FUNCTIONAL_TEST_MATRIX.md` (use-cases → coverage map)
- `COMPATIBILITY.md` (environment matrix)

## Merge-ready guidance (for large changes)

If you are preparing a PR that touches tests + docs + CI together, keep it reviewable by splitting into logical commits:

1. `docs:` documentation-only changes (README, docs/, root checklists)
2. `test:` unit/contract/E2E changes (Vitest + Playwright)
3. `ci:` workflow adjustments (GitHub Actions)

Always keep `npm run test:pr` green after each step when possible.
