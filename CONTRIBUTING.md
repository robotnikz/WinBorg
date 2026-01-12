# Contributing

Thanks for your interest in contributing to WinBorg.

## Quick start

### Prereqs
- Node.js (use the version from the CI workflow in `.github/workflows/cicd.yml`)
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

### E2E tests (Electron)
```bash
npm run test:e2e
```

## Branching & PRs
- Default branch: `main`
- Prefer small, focused PRs.
- For dependency upgrades, keep changes scoped and avoid mixing unrelated refactors.

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
