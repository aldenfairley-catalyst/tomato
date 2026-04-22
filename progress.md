Original prompt: Stabilize the modular split in NodePlane/tomato and restore gameplay parity with the latest working HTML build without losing implemented systems.

- 2026-04-23: Audited the live modular repo. Core simulation, ad priority, late-game tax/share endings, locust spawns, and most weapon behavior already survived the split.
- 2026-04-23: Remaining gaps identified before edits: canonical `flags` state/reset, item-registry ownership for book/launch pad, fallout ownership in `weapons.js`, mutant tomato visual/news parity, and browser smoke-test hooks.
- 2026-04-23: Added deterministic browser hooks via `window.render_game_to_text`, `window.advanceTime`, and `window.__TOMATO_DEBUG__` so parity checks can run without waiting through a full live session.
- 2026-04-23: Browser smoke matrix passed for gate/password/comic flow, one-time book + launch pad ownership, restart flag reset, nuke fallout overlay/irradiation, mutant tomato ticker + dedicated sprite render, shareholder ending override, cobalt-mine fail state, tax-pocalypse trigger, and popup blocker upkeep. Artifacts live under `output/smoke/`.
