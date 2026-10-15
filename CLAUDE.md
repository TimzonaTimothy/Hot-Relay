# Hot Relay — notes for Claude Code

**Read `TASKS.md` first.** It is the task board: `[ ]` todo, `[~]` ongoing, `[x]` done, `[-]` parked.
When you start a task mark it `[~]`; when it is finished mark it `[x]` and append `(done YYYY-MM-DD)`.
Keep the **Now** section current. No more than 3 tasks `[~]` at once.

## Scope rule

Only build what serves the current gate or a hypothesis (H1–H12 in the plan doc), or what is
required to ship. Anything else goes on the "Parked — not now" list in `TASKS.md`.
Current gate: **Gate 3 → Gate 4** (prototype + character vertical slice done; playtests next).
No backend until Gate 4 passes.

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
  config/                 constants (sizes, colours, depths), tuning (feel numbers incl. water, air)
  data/operators.ts       Kemi / Rurik / Mei-Lin / Tari: stats, swim profile, weapons, entry attack
  data/weapons.ts         weapon catalogue (fire rate, mag, reload, recoil, underwater rule)
  data/stages/            stage format + greybox01 layout (water volumes, hazards, insertion)
  art/                    PLACEHOLDER art drawn at boot: characters (rig atlas), fx (effects,
                          hazards, helicopter), stageArt (painted platforms), paint helpers
  entities/               Player (controller), Rig (cut-out visuals), Enemy, Rifleman,
                          Hazards (Mine, EelDrone, Grate, Cache), BulletPool
  stage/                  visual-only helpers for StageScene: Effects, WaterView, Foliage,
                          CameraRig, Insertion (helicopter cinematic)
  scenes/                 Boot, Preload, Menu, Squad, Stage, Hud, Pause, Results, Stress
  systems/                pure logic: FixedStep, JumpController, Squad (+air, arsenal), Arsenal,
                          anim (state machine), water (swim physics), geometry, insertion
                          (timeline), aim, rank, SaveStore, InputManager, FpsMeter, Telemetry,
                          Sfx, flags, services, pwa
  ui/                     theme, MenuList, TouchControls, Backdrop, ParallaxStrip, settings, hudState
tests/                    logic, anim and character (water, arsenal, air, geometry, insertion) tests
scripts/smoke.mjs         headless end-to-end checks (see README)
ASSETS.md                 every placeholder texture and sound, and what replaces it
```

## Character system rules

- **Characters are data.** Add an operator in `data/operators.ts` (and a palette + parts in
  `art/characters.ts` keyed by its `rig`). Weapons are data in `data/weapons.ts`.
- **Physics body ≠ visuals.** Player and enemies are invisible 12×20 Arcade bodies; the `Rig`
  draws them. Never size hitboxes from art.
- **Animation:** `systems/anim.ts` decides the state in fixed steps; `Rig` blends poses per
  frame. New states go in both, plus the transition table and a test.
- **Water** is rectangles in stage data (`water`); `systems/water.ts` is the only swim physics.
  Visuals (`stage/WaterView.ts`) read the same rectangles, so they always match.
- **Insertion** is a pure timeline (`systems/insertion.ts`) drawn by `stage/Insertion.ts`. The
  landing height is measured from level geometry, never hard-coded.
- **Placeholder art keeps its keys.** Final art must reuse the texture keys and pivots in ASSETS.md.

## URL flags (playtests)

- `?mode=solo` — single operator, 3 lives (H2 baseline). Default is relay.
- `?debug=1` — fps overlay, F2 toggles physics bodies, menu shows mode toggle + stress test.
- `?stage=stress` — TEST-01 stress scene (60 enemies, ~200 bullets, 10 s fps measurement).
- `?autostart=1` — skip the menu (used by the smoke test); also skips the insertion.
- `?squad=a,b,c` — squad in relay order; `?insertion=play|skip` — force or skip the opening cinematic.
