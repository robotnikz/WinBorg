# UX_CHECKLIST (WinBorg)

A quick manual UI regression checklist (10–15 minutes).

## Startup

- App launches and renders the sidebar + title bar.
- Dashboard loads without errors.

## Onboarding

- If WSL/Borg missing: onboarding modal appears with actionable guidance.
- If ready: onboarding does not block the main UI.

## Repositories

- Add repository modal opens.
- “Test SSH & Remote Connection” shows success/failure states (SSH via a selected Connection).
- Connect/disconnect state updates in UI.

## Jobs

- Jobs modal opens.
- Create job and see it in the list.
- Run job now: success toast appears.

## Archives

- Archives view shows list after connect.
- Browse files modal opens and navigation works.
- Download selection shows success or error modals.

## Mounts

- Mount archive shows mounted state.
- Open folder works.
- Unmount cleans up.

## Settings

- Settings load and saving persists across restart.
- Import/export settings works.
- Test notifications (if configured) runs without crashing.
