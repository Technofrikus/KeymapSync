# Platform Plan: Web App + Small Desktop App

Goal: one KeymapSync app that runs both in the browser (no install) and as a small
desktop app (Tauri instead of Electron), with a streamlined feature set.

## Target picture

```
            ┌──────────────────────────────────────────┐
            │  Shared app (HTML/CSS/JS)                │
            │  editor, online sync, previews, rules,   │
            │  validation, .vil transformation         │
            └──────────────┬───────────────────────────┘
                           │  "platform" interface
          ┌────────────────┴────────────────┐
  ┌───────┴────────┐                ┌───────┴────────┐
  │  Web shell     │                │ Desktop shell  │
  │  WebHID (JS    │                │ Tauri + vitaly │
  │  Vial protocol)│                │ (unchanged)    │
  │  upload/       │                │ native file    │
  │  download      │                │ dialogs        │
  └────────────────┘                └────────────────┘
```

The shared app never talks to the keyboard or disk directly. It calls a small
platform interface, and each shell implements it:

| Area | Calls | Web shell | Desktop shell |
|------|-------|-----------|---------------|
| Keyboard | `discover`, `snapshot`, `apply`, `lock`, `layout`, `fetchDefinition` | WebHID + JS Vial protocol | vitaly (as today) + Rust HID for definitions |
| Config | `chooseConfig`, `loadConfig`, `saveConfig` | file picker / download (File System Access API in Chrome when available) | native dialogs |
| Backup | `saveBackup` | download `.vil` | native save dialog |
| App | `defaults`, `setUnsavedChanges` | `beforeunload` warning | window close guard |

This matches the existing seam: `device-transport.js` already hides vitaly behind
exactly these keyboard calls, and the renderer already goes through `window.api`.

## Phase 0 — Streamline (in current Electron app) — done

Small, low risk, makes every later phase smaller.

- Remove the Offline Sync screen: `offline-workflow.js`, its test, the nav button
  and view in `index.html`, `generator:run` IPC, the `directory:*` grant flow if
  nothing else uses it, and related docs/smoke-test steps.
- Remove the command-line tool (`generate_vial_keymaps.js` at repo root and the
  `original/` / `output/` folders). The transformation module itself stays — online
  sync uses it — and no longer touches the file system.
- Delete `gui-electron/unsued icons/`.
- Update README and `docs/*`.

Done when: app works with Editor + Online Sync only, tests green, smoke test passes.

## Phase 1 — Separate the shared app from Electron

- Move shared UI and logic into `app/` (or `src/`), shells into `shells/web/` and
  `shells/desktop/`. Electron stays as the desktop shell during this phase.
- Convert shared modules from Node style (`require`, `Buffer`) to browser-ready
  ES modules (`import`, `Uint8Array`). Decompression: replace `lzma`/`xz-decompress`
  Node usage with a browser-compatible build of the same library.
- Define the platform interface (table above) as one file; Electron implements it
  via the existing IPC.
- Add a simple bundler (Vite) so the same source builds for web and desktop.

Done when: Electron app works exactly as after Phase 0, but all shared code has no
Node/Electron dependencies.

## Phase 2 — Web shell (WebHID)

Reference implementations (all open source, check licenses before copying code):

- **vial-gui** (`vial-kb/vial-gui`, GPL-2.0) — the code behind vial.rocks. The web
  build runs the same Python client in the browser and uses WebHID underneath. Use
  it as the authoritative reference for the Vial protocol: keymap read/write,
  macros, tap dance, combos, key overrides, unlock/lock sequence.
- **VIA web app** (`the-via/app`, GPL-3.0) — TypeScript + WebHID; good reference for
  device picking, permission handling and the base VIA commands.
- **pipette** — already used as reference for `vial-fetch-definition.js`.
- **vitaly** — our desktop tool; its source shows exactly what we currently send,
  so the web version can do the same steps.

Work:

1. HID transport: WebHID device picker (usage page `0xFF60`, usage `0x61`),
   32-byte send/receive, timeouts, reconnect.
2. Port `vial-fetch-definition.js` to use that transport (it already speaks the
   protocol; only the HID layer changes).
3. Implement the Vial commands we need for read (`snapshot`) and write (`apply`):
   layer keymaps, tap dance, combos, key overrides, layout options, plus
   unlock/lock. Produce/consume the same Keymap State JSON vitaly does, so the
   rest of the app does not change.
4. Test: compare web `snapshot` output against vitaly output on the same keyboard
   (should be identical); round-trip `apply` → `snapshot`.
5. Host as a static site (e.g. GitHub Pages). Show a clear message on Safari/Firefox
   (no WebHID). HTTPS is required for WebHID.

Risks:
- Writing the Vial protocol is the largest new piece; keep scope to what KeymapSync
  actually changes.
- Unlock (Vial security) needs a user key-press flow in the UI.
- Licensing: the project is GPL-3.0-or-later, so code from vial-gui (GPL-2.0-or-later)
  and VIA (GPL-3.0) may be reused with attribution.

Done when: a user can open the site in Chrome/Edge, connect a keyboard, edit
mappings, preview and write — same result as the desktop app.

## Phase 3 — Desktop shell on Tauri

- Create a Tauri app that loads the shared app build.
- Implement the platform interface in Rust commands:
  - keyboard calls → run bundled vitaly (as `device-transport.js` does today);
  - `fetchDefinition` → small Rust HID read (or reuse vitaly if it exposes it);
  - files → Tauri dialog + file system plugins.
- Bundle vitaly as a Tauri "sidecar" (per OS). Later option: link vitaly as a Rust
  library instead of a separate program.
- Optional later simplification: once the JS protocol from Phase 2 is proven, the
  desktop shell could use it too through a tiny Rust HID pass-through, and drop
  vitaly. Then there is only one keyboard implementation to maintain.
- Builds for macOS, Windows, Linux via GitHub Actions (replace the Electron
  release workflow). Code signing as today.
- Remove Electron, `node-hid`, electron-builder.

Done when: installers are ~10 MB, smoke test passes on macOS and Windows.

## Phase 4 — UI redesign

Do it after Phase 1 at the earliest, so the new UI is built once in the shared app
and both shells get it. It can run in parallel with Phase 3.

- Collect what's not working on each screen (screenshots + notes).
- Define the main flow: connect keyboard → review mappings → preview changes → write.
- Redesign screens, then implement in the shared app.

## Order and rough size

| Phase | Size | Depends on |
|-------|------|------------|
| 0 Streamline | small | — |
| 1 Shared app | medium | 0 |
| 2 Web shell | large (protocol work) | 1 |
| 3 Tauri shell | medium | 1 (independent of 2) |
| 4 UI redesign | medium | 1 |

Each phase ships on its own; the Electron app keeps working until Phase 3 replaces it.

## Decisions

1. Command-line tool: removed (Phase 0).
2. License: GPL-3.0-or-later.
3. Order after Phase 1: web first.
