# Tomato Billionaire

A static-browser game repo extracted from the original single-file prototype.

## Structure

- `index.html` — app shell and DOM overlays
- `styles/main.css` — shared CRT/pixel UI styles
- `src/game.js` — gameplay runtime, update loop, rendering orchestration
- `src/config/index.js` — palette, config, and phase data
- `src/entities/sprites.js` — sprite registry and pixel helpers
- `src/entities/index.js` — entity barrel exports
- `src/content/registries.js` — ticker text, ads, propaganda, and narrative registries
- `src/content/index.js` — content barrel exports
- `src/state/gameState.js` — central mutable game state
- `src/state/index.js` — state barrel exports
- `src/main.js` — boot file
- `assets/intro/1.svg` ... `6.svg` — placeholder comic intro panels
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Local run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages

Push this repo to GitHub and enable Pages from Actions. The included workflow publishes the static site automatically.

## Modularisation notes

This repo is now split so the biggest static domains are no longer embedded inside one monolithic file. The next natural extraction points are the entities/pests, systems, and UI/editor layers.

The `src/systems/` and `src/ui/` directories are included as the next extraction targets so the repo can keep evolving without another giant one-shot rewrite.


## Current module layout

The repo now uses a safer extraction split around the original gameplay core:

- `src/game.js` orchestrates bootstrap, shared helpers, entities, and the intro patch layer
- `src/systems/shop.js` handles shop state, purchasing, and shop rendering helpers
- `src/systems/weapons.js` handles weapon selection, firing, cooldowns, and special FX triggers
- `src/systems/input.js` handles click routing and gameplay interactions
- `src/systems/update.js` handles the main simulation update loop
- `src/ui/render.js` handles HUD and gameplay rendering
- `src/ui/flow.js` handles intro and game-over presentation
- `src/ui/editor.js` handles the sprite editor overlay

This split is intentionally conservative so behavior stays aligned with the working browser version.

## Tomato Joke

Why did the tomato turn red? Because it saw the salad dressing! 🍅 🍅
