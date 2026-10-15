# Hot Relay — notes for Claude Code

**Read `TASKS.md` first.** It is the task board: `[ ]` todo, `[~]` ongoing, `[x]` done, `[-]` parked.
When you start a task mark it `[~]`; when it is finished mark it `[x]` and append `(done YYYY-MM-DD)`.
Keep the **Now** section current. No more than 3 tasks `[~]` at once.

## Scope rule

Only build what serves the current gate or a hypothesis (H1–H12 in the plan doc), or what is
required to ship. Anything else goes on the "Parked — not now" list in `TASKS.md`.
Current gate: **Gate 3 → Gate 4** (prototype done; playtests next). No backend until Gate 4 passes.

## Stack

- Phaser 4 (Arcade physics) + TypeScript (strict) + Vite 8
- PWA via `vite-plugin-pwa` (Workbox, precaches the whole build; plays offline after first visit)
- Saves in IndexedDB via `idb-keyval`, memory fallback
- Vitest for pure logic, Playwright for the headless smoke test
- Later (Gate 5+): FastAPI + PostgreSQL on Railway for cloud save, ledger, payments

## Commands

| Command                           | What it does                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server (service worker disabled in dev)                                                                    |
| `npm run build`                   | Typecheck + production build to `dist/`                                                                        |
| `npm run preview`                 | Serve `dist/` on port 4173                                                                                     |
| `npm test`                        | Unit tests (`tests/`)                                                                                          |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                                              |
| `npm run e2e`                     | Headless smoke test against `dist/` (needs a Chromium; set `CHROME_PATH` if Playwright's own is not installed) |

Always run `npm run typecheck && npm run lint && npm test && npm run build` before committing.
Run `npm run e2e` after gameplay changes.

## Architecture rules

- **Fixed timestep.** All gameplay and physics advance in `StageScene.tick(dt)` at 60 steps/s
  (`FixedStep`). Arcade is in `customUpdate` mode; each tick calls `world.update` then
  `world.postUpdate`. Never put gameplay in `update()` — it only feeds ticks and draws.
- **Pure logic lives in `src/systems/`**, which never imports Phaser. Squad/Relay rules, aim,
  rank, saves, input merging and the fps meter are unit-tested there. Add a test when you
  change them.
- **Tuning numbers live in `src/config/tuning.ts`** and `src/data/operators.ts`. Don't hard-code
  feel values inside entities.
- **Input** comes from one `InputManager` (keyboard, Gamepad API, touch). Presses are latched
  until a tick consumes them. Scenes never read the keyboard directly.
- **Arcade overlap callbacks**: argument order is not guaranteed for array-vs-group checks.
  Identify objects by type (`instanceof Bullet`), as `StageScene.addColliders` does.
- **Zoomed camera**: world camera is zoom ×2 (480×270 logical in a 960×540 canvas). Objects with
  a scroll factor other than 1 must be offset by `(CANVAS - VIEW) / 2` — see `buildBackground`.
- **Phaser 4 differences**: no `setTintFill` (use `setTint(c).setTintMode(Phaser.TintModes.FILL)`),
  `Geom.Point` is gone (use `Vector2`), `Math.TAU` is 2π. API notes ship in
  `node_modules/phaser/skills/*/SKILL.md` — read them before using an unfamiliar API.
- **Never trust the client** for currency, unlocks or scores once the backend exists.
- Placeholder art is generated in `PreloadScene`; keep texture keys stable when real atlases land.

## File map

```
src/
  main.ts                 game config, scene list, service worker
  config/                 constants (sizes, colours, depths), tuning (feel numbers)
  data/operators.ts       Kemi / Rurik / Mei-Lin stats and weapons
  data/stages/            stage format + greybox01 layout
  entities/               Player, Enemy base, Rifleman, BulletPool
  scenes/                 Boot, Preload, Menu, Stage, Hud, Pause, Results, Stress
  systems/                FixedStep, JumpController, Squad, aim, rank, SaveStore,
                          InputManager, FpsMeter, Telemetry, Sfx, flags, services, pwa
  ui/                     MenuList, TouchControls, settingsItems, hudState
tests/logic.test.ts       unit tests
scripts/smoke.mjs         headless bot + offline/touch/stress checks
scripts/make-icons.mjs    regenerates placeholder PWA icons
```

## URL flags (playtests)

- `?mode=solo` — single operator, 3 lives (H2 baseline). Default is relay.
- `?debug=1` — fps overlay, F2 toggles physics bodies, menu shows mode toggle + stress test.
- `?stage=stress` — TEST-01 stress scene (60 enemies, ~200 bullets, 10 s fps measurement).
- `?autostart=1` — skip the menu (used by the smoke test).


# Git Commit Rules

* Never include `Co-Authored-By: Claude` or any Claude-related co-author attribution in commit messages.
* Never include `Generated with Claude Code` in commit messages or pull request descriptions.
* Do not add AI tool names, AI attribution, or AI promotional text to Git commit messages.
* Write concise, conventional commit messages that describe only the actual code changes.
* Preserve the project's existing Git author identity.
* Before committing, inspect the proposed commit message and ensure it contains no unwanted AI attribution.
