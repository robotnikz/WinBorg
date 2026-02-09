# WinBorg – UX/CRO/Accessibility Audit (2026-02-09)

Scope: Renderer UI (Electron/React) based on repo artifacts (README, docs, key views/components). This is a *code-informed audit*; screenshots and real user recordings would sharpen visual/spacing/contrast judgments.

## Phase 1 – Verständnis der App

### Kernproblem
WinBorg macht **BorgBackup** auf Windows nutzbar, ohne dass Nutzer in CLI/WSL-Diagnostik versinken: Setup (WSL/Ubuntu/Borg), SSH-Verbindungen, Repos, Jobs/Schedules, Restore (Browse/Diff/Mount/Extract) – alles als GUI.

### Vermutete Zielgruppe
- Windows 10/11 Nutzer mit Backup-Bedarf, die Borg wollen aber keine Linux-CLI.
- HomeLab/NAS/StorageBox/BorgBase User.
- Sicherheits-/Ransomware-bewusste Nutzer (Client-side encryption, dedupe).

### Happy Path (Idealfluss)
1) **First Launch** → System check (WSL + Borg)
2) Falls nötig: **Onboarding** → WSL/Ubuntu installieren → Borg installieren → System Ready
3) **Connections** → SSH Key erzeugen/importieren → Deploy Key → Test SSH
4) **Repositories** → Repo hinzufügen → „Test SSH & Remote Connection“ → Connect/Initialize
5) **Jobs** → Job erstellen + Schedule aktivieren
6) **Run** → erster erfolgreicher Backup-Lauf
7) **Restore proof** → Archive browsen / einzelne Datei extrahieren / Mount testen

CRO-Definition (für diese App): „Conversion“ = *time-to-first-successful-backup* + *restore verification*.

---

## Phase 2 – Detailliertes Audit

### Intuitivität & Workflows
**Stärken**
- Dashboard hat sinnvolle Quick-Start Führung (Connection → Repo → Job).
- Jobs: klare Empty-State-CTA „Add Repository“.
- Restore/Archives: mächtige Ops (Browse/Diff/Mount/Delete) sichtbar in einer Liste.

**Risiken/Friktion**
- Onboarding ist (zurecht) gating, aber aktuell „all-or-nothing“: für Power-User fehlt ein klarer Pfad „Ich mache Setup manuell, zeig mir nur Schritte/Checks“.
- „Connections“ als Konzept ist korrekt, aber mental-model-lastig: viele Nutzer denken in „Server“/„Backup Target“ statt „Connection“.
- Repo-Pfad-Konstruktion (Auto `/home/<user>/…` bei relativen Inputs) kann überraschend sein und bei StorageBox/BorgBase/NAS-Setups falsche Pfade erzeugen.

### UI & Visuelle Hierarchie
**Stärken**
- Cards/Stats/Quick-Start erzeugen klare Hierarchie.
- RepoCard: Status + Primary actions gut gebündelt.

**Risiken**
- Wichtige Primär-CTAs variieren in Stil (manche sind `Button`, manche „raw button“). Das kann wahrgenommenes „was ist wichtig/primär“ verwässern.
- Sidebar enthält „Developed by …“ sehr prominent; für Non-Dev Nutzer ist das eher Ablenkung als Value.

### Farben & Kontraste (Accessibility)
- Dark-mode nutzt teils harte Hex-Farben und teils Tailwind Slate. Das ist ok, aber begünstigt Inkonsistenzen.
- Fokus-States sind inkonsistent: Inputs haben explizite `focus:ring-blue-500/20`, aber der Standard-`Button` setzt `focus:ring-2` ohne festgelegte Ring-Farbe.

### Responsiveness
- Viele Layouts sind grid-basiert und haben sinnvolle Breakpoints.
- Restore/Archives: Suche ist auf `sm` versteckt (mobile). Für Electron weniger kritisch, aber trotzdem: kleine Fenster/Touch/Laptop-Tablet Mode könnten leiden.

### Mental Models (Jakob’s Law)
- Restore als Sidebar-Item, aber View-Titel „Archives“: mental ok, aber sprachlich inkonsistent.
- „Mount“/„Archives“ sind Borg-typische Begriffe; für Einsteiger braucht es mehr Outcome-orientierte Labels: „Browse files“, „Restore files“, „Mount as drive“.

---

## Phase 3 – Actionable Feedback

### Executive Summary
WinBorg hat bereits sehr solide, produktive Flows (Quick Start, Jobs, Restore-Operations) – der größte Hebel liegt jetzt in **Fehler-/Edge-Case-Führung**, **klarerem Mental Model (Connection/Repo)** und **Accessibility (Modal Fokus/Keyboard)**. Wenn diese Punkte sitzen, steigt die „First successful backup“-Conversion spürbar.

### Critical Issues (Prio 1)
1) **Modal Accessibility: kein Focus-Trap / Fokus-Management inkonsistent**
   - Onboarding-Modal und verschiedene Confirm-Dialogs setzen Rollen, aber es fehlt ein echtes Focus-Trap + initialer Fokus auf den primären CTA.
   - Risiko: Keyboard-only Nutzer „fallen“ hinter das Modal; Screenreader-Flow ist unsauber.

2) **Archive-Operationen hängen implizit an „erstes verbundenes Repo“**
   - In Archives/Restore wird das aktive Repo über `repos.find(r => r.status === 'connected')` abgeleitet.
   - Risiko: Bei mehreren verbundenen Repos können Diff/Delete/Mount auf das falsche Repo gehen (High-severity, data-loss risk).

3) **Repo-Pfad-/URL-Konstruktion kann falsche Ziele erzeugen**
   - Auto-`/home/<user>/…` ist eine starke Annahme.
   - Risiko: Frust bei StorageBox/BorgBase (oft feste Pfade), unnötige Fehlversuche → Drop-off.

4) **Inkonsequente Primär-CTA-Komponenten**
   - Mischung aus `Button` und custom `<button>` Styles.
   - Risiko: visuelle Priorität driftet; Fokus/disabled/loading Verhalten uneinheitlich.

### Quick Wins (Prio 2)
- **Wording vereinheitlichen** (durchgehend Outcome-first):
  - „Connections“ → „Servers“/„Targets“ (oder zumindest erklärender Subtext „SSH host profiles“).
  - „Archives“/„Snapshots“ konsistent (Dashboard nutzt „Snapshots“, View nutzt „Archives“).
- **Fokus-Stil standardisieren** (ein Fokus-Ring für alle Buttons/Inputs, auch in Dark Mode).
- **Checkbox-Labels** in Archives-Tabelle: `aria-label="Select archive <name>"`.
- **Empty/Blocked States**: Wenn kein Repo verbunden ist, statt rotem Text eine klare Card mit CTA „Go to Repositories → Connect“.

### Strategic Recommendations
Kein komplettes Redesign nötig; die visuelle Richtung ist modern und passend. Strategisch würde ich eher:
- „First Backup“ als *geführten Funnel* verstehen (Setup → Connection → Repo → Job → Run → Verify restore) und die UI so strukturieren, dass der Nutzer **nie rätseln muss, was als nächstes**.
- Restore als „Proof of safety“ stärker betonen: nach erstem Backup eine weiche Empfehlung „Test restore now (1 minute)“.

### Mockup-Ideen (konkret)
1) **Restore/Archives: Repo-Selector + Context Banner**
   - Oben links ein Dropdown: „Repository: <name>“ + Statuspill.
   - Darunter ein Banner „You are viewing archives for <repo>“.
   - Alle Actions (Diff/Delete/Mount) beziehen sich sichtbar auf dieses Repo.

2) **Onboarding: 2-Spalten Layout (Status links, Actions rechts)**
   - Links: Checklist (WSL, Ubuntu distro, Borg) mit aktuellen States.
   - Rechts: Primärer Button (z.B. „Install Ubuntu“) + sekundär „I’ll do it manually“ (zeigt PowerShell/Bash Commands + Copy).
   - Unten: „Re-check“ und „Troubleshooting“ Link.

3) **Repositories Add Flow: explizite Felder statt Magie**
   - Feld 1: Connection (dropdown)
   - Feld 2: Repo Path (mit placeholder `/./backup`)
   - Live-Preview: „Will connect to: ssh://user@host:22 + /./backup“
   - Kein auto `/home/user` ohne explizites Opt-in („Assume home dir“ checkbox).

---

## Screenshot Findings (konkret)

Basierend auf den bereitgestellten Screens (Dark Mode): Dashboard, Connections, Repositories, Jobs, Restore/Archives, Restore/Mounts.

### Dashboard
**Was gut ist**
- KPI-Karten + „Active Repositories“ sind klar priorisiert.
- „Live Activity“ liefert Trust/Feedback (CRO: Vertrauen in Backups).

**Critical (Prio 1)**
- **Status-Widerspruch:** Repo zeigt gleichzeitig `OFFLINE` und `HEALTHY`. Das bricht das Mental Model ("gesund" ohne Verbindung wirkt wie ein Bug).
   - Änderung: Health nur als *„Last backup freshness“* (z.B. "Last backup: 9h ago" + Status "OK/Warn/Critical") oder Health-Badge nur bei `connected`.
- **CTA-Label unklar:** „Connect Source“ ist zu generisch.
   - Änderung: strikt state-based: `Connect repository` (offline) / `Refresh` (online) / `Run backup now` (wenn job existiert).

**Quick Wins (Prio 2)**
- „View Full History“ wirkt disabled/zu low-contrast → als klarer Link/Button mit Kontrast.
- System Status Card (lila): Wenn klickbar, visuell wie CTA (Chevron + "Details") und nicht nur dekorativ.

### Connections
**Was gut ist**
- „Add Connection“ ist eindeutig als Primary.
- SSH-Key-Management oben ist sinnvoll (weil es Prereq für alles ist).

**Critical (Prio 1)**
- **Kein expliziter Flow:** Nutzer müssen selbst ableiten: Generate/Import → Deploy Key → Test SSH.
   - Änderung: Stepper in jeder Connection-Card ("1 Deploy key" → "2 Test SSH") und in der SSH-Key-Card ein kurzer "Next step" Hinweis.

**Quick Wins (Prio 2)**
- Public Key: Copy-Button direkt am Feld + „Copied“ Toast (reduziert Friktion beim Copy/Paste).
- „Generate“ ist riskant (Overwrite) → visuell als secondary + Warn-Text direkt neben Button, nicht versteckt.
- Reorder-Buttons rechts sind sehr klein → größere Touch-Targets oder Drag-handle + Tooltip.

### Repositories
**Was gut ist**
- Search + „Add Repository“ oben entspricht Standards.
- Cards haben klare Primary Action („Connect“) im Offline-State.

**Critical (Prio 1)**
- **Aktionen wirken unabhängig vom State gleichwertig** (z.B. „Unlock“ erscheint auch, wenn Repo offline ist).
   - Änderung: actions state-based reduzieren:
      - offline: `Connect`, `Edit`, `Remove`
      - online: `Run backup`, `Manage jobs`, `Restore/Mount`, `Maintenance`, `Export key`

**Quick Wins (Prio 2)**
- Repo-URL dominiert. Voll-URL als tooltip/expand; in card primär „Target“ + „Repo path“.
- „Today 22:00“ als "Next run" labeln (damit sofort klar ist, was lila bedeutet).

### Jobs
**Was gut ist**
- Pro Repo ein klarer Einstieg „Manage Jobs“.

**Critical (Prio 1)**
- **Screen wirkt leer** und bietet keinen "Create schedule"-Funnel.
   - Änderung: Wenn `0 jobs`: Primary CTA "Create first job" direkt in der Repo-Card (statt nur "Manage Jobs").

**Quick Wins (Prio 2)**
- Wenn Jobs existieren, aber kein Schedule aktiv: deutlicher Warn-State + CTA "Enable schedule".

### Restore / Archives
**Was gut ist**
- Tabelle ist effizient, Actions sind schnell erreichbar.
- Tabs „Archives/Mounts“ sind ein gutes Modell.

**Critical (Prio 1)**
- **Kontext-Widerspruch:** „Connect to a repository to view archives“ wird angezeigt, obwohl Archive sichtbar sind.
   - Änderung: State muss konsistent sein: entweder blocken/Empty-State, oder Repo-Kontext anzeigen.
- **Repo-Kontext fehlt:** es ist nicht sichtbar, welches Repo gerade aktiv ist.
   - Änderung: Repo selector + Banner „Viewing archives for <Repo>“; alle Actions daran koppeln.

**Quick Wins (Prio 2)**
- Action-Icons ohne Text funktionieren, brauchen aber starke Tooltips + konsistente hover/focus states.
- Selection UX: wenn 1–2 ausgewählt, oben eine klare "N selected" pill + Diff/Delete dauerhaft im Actionbar-Bereich.

### Restore / Mounts
**Was gut ist**
- Empty State erklärt das Feature und hat einen CTA.

**Critical (Prio 1)**
- **Doppel-CTA Konflikt:** Oben rechts „+ New Mount“ konkurriert mit „Mount your first archive“.
   - Änderung: Im Empty-State nur *eine* Primary Action (Label konsistent, idealerweise "New mount").

**Quick Wins (Prio 2)**
- Empty-state CTA sollte direkt in den Archive-Picker springen (oder auf Archives Tab wechseln und Mount-Dialog öffnen).

---

## Offene Fragen (für bessere Präzision)
1) Soll die App primär Englisch bleiben oder willst du DE-Lokalisierung?
2) Ziel-Setups: eher BorgBase/StorageBox oder self-hosted NAS/VPS? (beeinflusst Defaults für Ports/Paths/hostkey policy)
3) Gibt es Telemetrie/Events? (für CRO-Messbarkeit: time-to-first-backup, step drop-offs, top error reasons)

