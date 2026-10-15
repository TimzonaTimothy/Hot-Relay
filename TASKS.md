# Hot Relay — Task Board

Single source of truth for what is **todo**, **ongoing** and **done**.
Keep this file in the repo root so Claude Code can read and update it.

**Status legend**

| Mark  | Meaning          |
| ----- | ---------------- |
| `[ ]` | Todo             |
| `[~]` | Ongoing          |
| `[x]` | Done (add date)  |
| `[-]` | Dropped / parked |

**Gate tags** `G1`–`G9` match the roadmap in the plan doc (section 13).

**Rules**

1. No more than 3 tasks `[~]` at the same time.
2. Starting a task: `[ ]` → `[~]`. Finishing: `[~]` → `[x]` and append the date, e.g. `(done 2026-10-20)`.
3. New tasks take the next ID in their module. Nothing is added unless it serves the current gate or a hypothesis (H1–H12).
4. Keep the **Now** section current; it is the first thing to read each session.

---

## Now

- **Ongoing:** SETUP-02 (owner must enable Pages + merge PR #2), PERF-01 (low-detail mode done; phone numbers to do), TEST-01 (needs 3 real devices — now also covers the character rigs, see PERF-01)
- **Next up:** PERF-01 real-phone numbers (try `?detail=low`), CHAR-16 (second water enemy pass), RES-02…RES-07, TEST-02/03 playtests
- **Current gate:** G3 prototype + character/swimming/insertion vertical slice → G4 playtests
- **Blocked:** H2 and H4 need 15–20 real testers (RES-13)
- **Last session (2026-10-15):** Character system vertical slice: four data-driven operators (Tari added),
  cut-out rigs with an animation state machine, weapons with magazines/reload/switching, swimming
  (surface, diving, buoyancy, air, drowning, ledge climb), a flooded basin with mines, an eel drone and
  a secret cache, the helicopter insertion cinematic, squad select, themed HUD/pause/results.
  62 unit tests and 32 smoke checks pass. Placeholder art and audio are listed in ASSETS.md.
- **This session (2026-10-15):** imported to github.com/TimzonaTimothy/Hot-Relay (PR #2), PERF-01 low-detail
  mode, fixed a flaky smoke-test bot at the arena crate. 71 unit tests, 33 smoke checks pass locally and on CI.

---

## RES — Research and planning

- [x] RES-01 Research & validation plan written (G1) (done 2026-10-14)
- [ ] RES-02 Answer the 4 open questions: hours/week, 12-week budget, home-market angle, blockchain reason (G1)
- [ ] RES-03 Play Contra: Operation Galuga 2h; 5 great moments, 5 frustrations (G1)
- [ ] RES-04 Play Broforce 2h; same notes (G1)
- [ ] RES-05 Play Huntdown 2h; same notes (G1)
- [ ] RES-06 Play a mobile Metal Slug 1h; touch-control notes (G1)
- [ ] RES-07 Play 5 Poki/CrazyGames action games on phone; time-to-first-fight (G1)
- [ ] RES-08 Write the one-page feel guide (run speed, jump height, fire rate, hit feedback) (G1)
- [ ] RES-09 Write and pin the "not now" list (G1)
- [ ] RES-10 Confirm concept: Hot Relay or record reason to switch (G1)
- [ ] RES-11 One-paragraph pitch + one-line Relay Swap hook (G2)
- [ ] RES-12 Interview script, 15 minutes (G2)
- [ ] RES-13 Recruit 15–20 testers (G2)
- [ ] RES-14 Run 15 interviews; log in a sheet (G2)
- [ ] RES-15 Pick working title; check stores, portals, trademarks (G2)

## SETUP — Project and tooling

- [x] SETUP-01 Repo: Phaser 4 + TypeScript + Vite (G3) (done 2026-10-15)
- [~] SETUP-02 GitHub repo + auto-deploy to a free static host (G3) — pushed to github.com/TimzonaTimothy/Hot-Relay (branch `vertical-slice`); CI runs on PRs; Pages deploy needs the repo admin to set Pages → Source: GitHub Actions (private repo: paid plan) and merge to main
- [x] SETUP-03 ESLint + Prettier + strict tsconfig (G3) (done 2026-10-15)
- [x] SETUP-04 Folder structure: `scenes/`, `entities/`, `systems/`, `data/`, `ui/` (G3) (done 2026-10-15)
- [ ] SETUP-05 Asset pipeline: sprite atlases, Tiled JSON loading (G3) — started: placeholder textures generated in code with stable keys; atlas + Tiled loader still to do
- [ ] SETUP-06 Git LFS for source art (G5)
- [x] SETUP-07 CLAUDE.md with stack, conventions and "read TASKS.md first" (G3) (done 2026-10-15)

## CORE — Game loop, scenes, camera

- [x] CORE-01 Scene flow: Boot → Preload → Menu → Stage → Results (G3) (done 2026-10-15)
- [x] CORE-02 Fixed-timestep update loop (G3) (done 2026-10-15)
- [x] CORE-03 Side-scrolling camera with look-ahead and stage bounds (G3) (done 2026-10-15)
- [x] CORE-04 Base resolution 480×270, pixel-perfect scaling (G3) (done 2026-10-15)
- [x] CORE-05 Pause and resume (incl. tab hidden) (G3) (done 2026-10-15)
- [x] CORE-06 Checkpoints and respawn (G3) (done 2026-10-15)

## MOVE — Player movement

- [x] MOVE-01 Run, acceleration, friction (G3) (done 2026-10-15)
- [x] MOVE-02 Jump with variable height (G3) (done 2026-10-15)
- [x] MOVE-03 Coyote time and jump buffering (G3) (done 2026-10-15)
- [x] MOVE-04 Drop through one-way platforms (G3) (done 2026-10-15)
- [ ] MOVE-05 Kemi dash-slide with i-frames (G5)
- [ ] MOVE-06 Rurik brace (planted front shield) (G5)

## COMBAT — Shooting, weapons, damage

- [x] COMBAT-01 8-way aim and fire (G3) (done 2026-10-15)
- [x] COMBAT-02 Bullet object pool (G3) (done 2026-10-15)
- [x] COMBAT-03 Health, armour, damage, death (G3) (done 2026-10-15)
- [x] COMBAT-04 Hit-stop, hit flash, screen shake (toggleable) (G3) (done 2026-10-15)
- [ ] COMBAT-05 Sidearms: Kestrel SMG, Bulwark LMG (overheat), Needle DMR (pierce) (G5) — started: weapons with magazines, reload, recoil and a P9 sidearm each (CHAR-03); LMG overheat to do
- [ ] COMBAT-06 Pickup crates + Fan, Arc Lance, Hornet (G5)
- [ ] COMBAT-07 Loadout slot + Breacher shotgun (G5)
- [ ] COMBAT-08 Mei-Lin Mark (weak-point bonus damage) (G5)
- [ ] COMBAT-09 Weapon data in JSON for tuning (G5) — started: all weapon numbers live in src/data/weapons.ts

## RELAY — Relay Swap

- [x] RELAY-01 Three placeholder operators with own stats (G3) (done 2026-10-15)
- [x] RELAY-02 Swap button + entry attack + brief invulnerability (G3) (done 2026-10-15)
- [x] RELAY-03 Bench armour regeneration (G3) (done 2026-10-15)
- [x] RELAY-04 Auto-swap on fall; fail when all three down (G3) (done 2026-10-15)
- [x] RELAY-05 Single-operator build flag for H2 A/B test (G3) (done 2026-10-15)
- [ ] RELAY-06 Rescue pods revive a fallen operator (G5)
- [x] RELAY-07 Squad HUD: three portraits, armour, swap cooldown (G5) (done 2026-10-15)

## CHAR — Character system, swimming, insertion

- [x] CHAR-01 Data-driven operators: stats, swim profile, two weapons, entry attack (src/data/operators.ts) (G3) (done 2026-10-15)
- [x] CHAR-02 Fourth operator: Tari (amphibious, speargun, surge dash) (G3) (done 2026-10-15)
- [x] CHAR-03 Weapon catalogue: fire rate, damage, mag, reload, recoil, underwater rule (src/data/weapons.ts) (G3) (done 2026-10-15)
- [x] CHAR-04 Arsenal: magazines, auto/manual reload, idle top-up, switch, underwater auto-switch (G3) (done 2026-10-15)
- [x] CHAR-05 Animation state machine with priorities, transition table, hold times (src/systems/anim.ts) (G3) (done 2026-10-15)
- [x] CHAR-06 Cut-out rig: blended procedural poses for 15 states, aim arm, recoil, reload, swim tilt (G3) (done 2026-10-15)
- [x] CHAR-07 Rig parts in one atlas (single batch for all characters) (G3) (done 2026-10-15)
- [x] CHAR-08 Swimming: surface float, dive, buoyancy, drag, stroke, water jump, sinkers walk the bed (G3) (done 2026-10-15)
- [x] CHAR-09 Ledge assist: climb out of water onto quays and pontoons (G3) (done 2026-10-15)
- [x] CHAR-10 Air: per-operator oxygen, drowning damage, refill at surface / on the bench (G3) (done 2026-10-15)
- [x] CHAR-11 Water rules for bullets: slowed and short-lived in water, speargun unaffected (G3) (done 2026-10-15)
- [x] CHAR-12 Water hazards: tethered mines, eel drone, breakable grate, supply cache (G3) (done 2026-10-15)
- [x] CHAR-13 Helicopter insertion: timeline, rope descent, rotor wash, rotor sound, camera handoff, skip after first view (G3) (done 2026-10-15)
- [x] CHAR-14 Effects: muzzle flash, casings, contact shadows, dust, splashes, bubbles, drips (G3) (done 2026-10-15)
- [x] CHAR-15 Stable side camera with ground anchor and water framing (G3) (done 2026-10-15)
- [ ] CHAR-16 Water combat pass after playtests: eel tuning, more underwater threats (G5)
- [ ] CHAR-17 Replace procedural poses with painted parts / hand-keyed animation (ART) (G5)
- [~] PERF-01 Measure stage + stress on 3 real phones; if below target add a low-detail setting (G4) — **Low-detail mode done (2026-10-15):** Detail Auto/High/Low in Settings and Pause, `?detail=` flag; Low hides bg-mid/bg-near, water light shafts, grass tufts, contact shadows; Auto drops to Low if the median fps over the first 4 s of play (after the insertion) is below 50 (`systems/detail.ts`, 9 unit tests, e2e check). Measured: Apple-silicon Mac (headless SwiftShader) is capped at 60 fps before and after on stage and stress; uncapped, Low is ~16% faster than High on the stage, no change on stress. GitHub runner (no GPU): bot run 21–25 fps median; arena High p50 20 / p10 15 vs Low p50 20 / p10 20; stress 43–60 fps (varies by runner). **Finding:** Low smooths the slow frames but does not lift the median on the slowest hardware, so the cut-out rigs are likely the main cost there; and the stage start is cheap (60 fps on CI), so Auto's first-4-s window keeps High on machines that slow down later. Next: measure on 3 real phones; consider a rolling Auto window and cheaper rigs (e.g. baked rig frames) if phones are below target

## ENEMY — Enemies

- [x] ENEMY-01 Enemy base class + state machine (G3) (done 2026-10-15)
- [x] ENEMY-02 Contractor rifleman with aim-flash telegraph (G3) (done 2026-10-15)
- [ ] ENEMY-03 Riot contractor (front shield) (G5) — a first version was built on the old Gate 3 prototype: branch `enemy-riot-contractor` (closed PR #1). Shield blocks frontal fire until it lowers to aim/fire or is stunned; rebuild it on the rig system
- [ ] ENEMY-04 Dock Crawler (walls and ceilings) (G5)
- [ ] ENEMY-05 Skitter swarm (groups of 6) (G5)
- [ ] ENEMY-06 Gantry sniper (laser line, then shot) (G5)
- [ ] ENEMY-07 Jetpack lancer (G6)
- [ ] ENEMY-08 Spawner / wave trigger system (G5) — started: arena trigger that locks the camera and drops 4 riflemen

## BOSS — Minibosses and bosses

- [ ] BOSS-01 Boss framework: phases, health bar, patterns (G5)
- [ ] BOSS-02 Harbour Mule miniboss (G5)
- [ ] BOSS-03 Dredger: phase 1 dredge-arm sweeps (G5)
- [ ] BOSS-04 Dredger: phase 2 mortar barrage (G5)
- [ ] BOSS-05 Dredger: phase 3 exposed core + rising tide (G5)
- [ ] BOSS-06 Heliarch (region 2) (G6)

## LEVEL — Stages and hazards

- [x] LEVEL-01 Greybox stage 1 (2–4 min) (G3) — ~70 s for the test bot; human time unknown until playtests (done 2026-10-15)
- [ ] LEVEL-02 Port Ileya stage 1 final in Tiled (G5)
- [ ] LEVEL-03 Port Ileya stage 2 (G5)
- [ ] LEVEL-04 Port Ileya stage 3 (G5)
- [ ] LEVEL-05 Boss stage (G5)
- [ ] LEVEL-06 Rising-tide hazard (G5)
- [ ] LEVEL-07 Moving crane platforms (G5)
- [ ] LEVEL-08 Optional dock-crew rescues + secrets (G5) — started: grate-hidden supply cache in the basin
- [ ] LEVEL-09 Region 2 Erg Saar stages 1–3 (G6)
- [ ] LEVEL-10 Region 3 Kessler Works (G6–G7)
- [ ] LEVEL-11 Region 4 Saikō Tiers (G7)

## INPUT — Controls

- [x] INPUT-01 Keyboard mapping (G3) (done 2026-10-15)
- [x] INPUT-02 Gamepad via browser Gamepad API (G3) (done 2026-10-15)
- [x] INPUT-03 Touch: virtual stick, jump, fire, swap (G3) (done 2026-10-15)
- [x] INPUT-04 Touch aim-assist and auto-fire options (G3) (done 2026-10-15)
- [ ] INPUT-05 Rebinding screen (G6)
- [ ] INPUT-06 Local co-op: second player on gamepad (G6)

## UI — Menus, HUD, results

- [x] UI-01 Main menu (G5) (done 2026-10-15)
- [x] UI-02 Pause menu (G3) (done 2026-10-15)
- [ ] UI-03 Settings: audio, shake, flashing, controls (G5) — started: shake, flashing, aim-assist, auto-fire, touch mode, sound, FPS; rebinding to do
- [ ] UI-04 In-stage HUD (health, ammo, pickups, squad) (G5) — started: squad cards, weapon/ammo/reload, air gauge, timer, callouts, cinematic letterbox; pickups to do
- [ ] UI-05 Results screen: rank, time, Scrip, medals (G5) — started: rank, time, downs, swaps, continues, secrets; Scrip and medals to do
- [ ] UI-06 Squad + loadout select screen (G5) — started: squad select (3 of 4, order = relay order); loadout to do
- [ ] UI-07 Upgrade screen (G5)
- [ ] UI-08 Story text panels + Ifeoma briefing (G5)
- [ ] UI-09 "Add to Home Screen" guide (iOS + Android) (G5)
- [ ] UI-10 Region map / stage select (G6)

## PWA — Install and offline

- [x] PWA-01 Web app manifest + icons (G3) (done 2026-10-15)
- [x] PWA-02 Service worker (Workbox) caches the build (G3) (done 2026-10-15)
- [x] PWA-03 Verify launch in airplane mode (G3) — verified headless with the network off; confirm on a real phone (done 2026-10-15)
- [ ] PWA-04 Update prompt when a new version is available (G5)
- [x] PWA-05 First download under 8 MB; lazy-load music (G3) — ~380 KB gzipped, no music yet (done 2026-10-15)
- [ ] PWA-06 Online/offline status indicator (G5)
- [ ] PWA-07 Region content downloads on demand (G6)

## SAVE — Local save and cloud sync

- [x] SAVE-01 IndexedDB wrapper (G3) (done 2026-10-15)
- [x] SAVE-02 Save settings and best ranks locally (G3) (done 2026-10-15)
- [ ] SAVE-03 Save schema with version number + migrations (G5) — started: versioned schema with field-by-field repair (v1)
- [ ] SAVE-04 Sync queue: store results offline, send when online (G5)
- [ ] SAVE-05 Cloud save upload/download (G5)
- [ ] SAVE-06 Conflict rule: server wins for currency; latest wins for settings (G5)

## AUTH — Accounts

- [ ] AUTH-01 Guest ID created on first launch (G5)
- [ ] AUTH-02 Register with email (magic link) (G7)
- [ ] AUTH-03 Login (G7)
- [ ] AUTH-04 Logout (G7)
- [ ] AUTH-05 Link guest save to new account (G7)
- [ ] AUTH-06 Social login (Google) (G7)
- [ ] AUTH-07 Session tokens + refresh (G7)
- [ ] AUTH-08 Delete account + data export (G8)
- [ ] AUTH-09 Rate limiting on auth endpoints (G7)

## API — Backend foundation

- [ ] API-01 FastAPI project + Docker (G5)
- [ ] API-02 PostgreSQL on Railway + migrations (Alembic) (G5)
- [ ] API-03 Deploy to Railway with health check (G5)
- [ ] API-04 CORS + HTTPS only + request validation (G5)
- [ ] API-05 Structured logging (G6)
- [ ] API-06 Load test (G8)

## ECON — Economy

- [ ] ECON-01 Scrip earned on stage clear (local) (G5)
- [ ] ECON-02 One upgrade tier for Breacher (G5)
- [ ] ECON-03 Server-side ledger: server grants all rewards (G6)
- [ ] ECON-04 Offline earnings reconciliation with plausibility checks (G6)
- [ ] ECON-05 Daily caps + replay reward decay (G6)
- [ ] ECON-06 Scrip shop (G6)
- [ ] ECON-07 Upgrade tiers 2–3 + parts (G6)
- [ ] ECON-08 Attachments (sidegrades) (G6)
- [ ] ECON-09 Dashboard: Scrip held per player (inflation watch) (G6)

## BILL — Billing and payments

- [ ] BILL-01 Choose Nigerian provider (cards, transfer, USSD) + global provider (G7)
- [ ] BILL-02 Product catalogue: full campaign, cosmetic packs (G7)
- [ ] BILL-03 Checkout page on own site (G7)
- [ ] BILL-04 Webhook: verify payment → unlock entitlement (G7)
- [ ] BILL-05 Entitlements table + restore purchases (G7)
- [ ] BILL-06 Separate USD and NGN pricing (G7)
- [ ] BILL-07 Refund handling (G8)
- [ ] BILL-08 Receipts by email (G7)
- [ ] BILL-09 Test with real Naira cards, transfer, USSD (G7)
- [ ] BILL-10 Fraud checks: duplicate webhook, chargebacks (G8)

## COSM — Cosmetics

- [ ] COSM-01 Skin system (palette swap / sprite variant), no stat changes (G7)
- [ ] COSM-02 3–5 launch skins (G7)
- [ ] COSM-03 Cosmetic shop UI (G7)
- [ ] COSM-04 Tracer colours and finisher effects (G9)

## LB — Leaderboards and challenges

- [ ] LB-01 In-game timer and splits (G5) — started: run timer; splits to do
- [ ] LB-02 Deterministic input recording (G7)
- [ ] LB-03 Server replay validation for ranked runs (G9)
- [ ] LB-04 Friends leaderboard (G9)
- [ ] LB-05 Global leaderboard (G9)
- [ ] LB-06 Daily challenge (no streaks) (G7)
- [ ] LB-07 Weekly remix "Ops" mode (G9)

## ANALYTICS — Tracking and errors

- [ ] ANALYTICS-01 Event endpoint + Postgres events table (G4)
- [ ] ANALYTICS-02 Events: start, first fight, deaths by section, swaps, clear, replay, session length, offline (G4) — started: events logged in memory (window.__hotRelay.telemetry); upload is ANALYTICS-01
- [ ] ANALYTICS-03 End-of-stage 3-question survey (G4)
- [ ] ANALYTICS-04 fps sampling (p50, p10) by device (G4)
- [ ] ANALYTICS-05 Error tracking in client + API (G6)
- [ ] ANALYTICS-06 Metrics dashboard: D1, D7, completion, conversion (G6)

## ART — Art and animation

- [ ] ART-01 Choose art style from H3 test (G2)
- [ ] ART-02 Quotes from 2 pixel artists (G2)
- [ ] ART-03 Kemi sprite set (G5)
- [ ] ART-04 Rurik sprite set (G5)
- [ ] ART-05 Mei-Lin sprite set (G5)
- [ ] ART-06 Port Ileya tileset + backgrounds (G5)
- [ ] ART-07 Region 1 enemy sprites (G5)
- [ ] ART-08 Harbour Mule + Dredger art (G5)
- [ ] ART-09 VFX: muzzle flash, impacts, explosions (G5) — placeholder procedural set in place (ASSETS.md)
- [ ] ART-10 Cultural reader review, region 1 (G5)

## AUDIO — Sound and music

- [x] AUDIO-01 Placeholder SFX set (G3) — synthesised in code, no files (done 2026-10-15)
- [ ] AUDIO-02 Final SFX pack (G5)
- [ ] AUDIO-03 Region 1 music track (G5)
- [ ] AUDIO-04 Audio settings + mute on tab hidden (G5)

## A11Y — Accessibility and difficulty

- [x] A11Y-01 Toggles: shake, flashing (G5) (done 2026-10-15)
- [ ] A11Y-02 Story and Normal difficulty (G5)
- [ ] A11Y-03 Hard difficulty (G6)
- [ ] A11Y-04 Iron Relay mode (post-campaign) (G9)
- [ ] A11Y-05 Slower game speed option in Story (G6)

## TEST — Playtests and QA

- [~] TEST-01 Stress scene: 60 enemies + 200 bullets on 3 devices (H10) (G3) — stress scene built (?stage=stress); 60 fps median in headless software rendering; needs 3 real devices
- [ ] TEST-02 H2 swap vs single-operator test, 15 players (G4)
- [ ] TEST-03 H4 touch vs keyboard test, 20 players (G4)
- [ ] TEST-04 Fix top 5 issues from sessions (G4)
- [ ] TEST-05 Gate 4 results memo + go/no-go decision (G4)
- [ ] TEST-06 Vertical slice playtest, 20 new players (G5)
- [x] TEST-07 Unit tests for game logic (G5) — 30 tests, started early (done 2026-10-15)
- [x] TEST-08 Playwright smoke test: load + play a stage (G6) — headless bot clears the stage + 9 other checks, started early (done 2026-10-15)
- [ ] TEST-09 Alpha community 50–100 testers (G6)
- [ ] TEST-10 Full device/browser pass, 5 devices (G8)

## PORTAL — Distribution

- [ ] PORTAL-01 itch.io page + devlog (G4)
- [ ] PORTAL-02 CrazyGames Basic Launch (H1) (G4)
- [ ] PORTAL-03 CrazyGames SDK integration (G7)
- [ ] PORTAL-04 Poki submission + SDK (G8)
- [ ] PORTAL-05 Portal revenue per 1,000 plays tracked (H12) (G7)

## LAUNCH — Legal, marketing, launch

- [ ] LAUNCH-01 Gameplay clips: TikTok, X, YouTube Shorts (G4, ongoing)
- [ ] LAUNCH-02 Landing page (G7)
- [ ] LAUNCH-03 Terms, privacy, refund policy + lawyer review (G8)
- [ ] LAUNCH-04 Company registration + tax setup (G8)
- [ ] LAUNCH-05 Trailer 60–90 s + capsule art (G8)
- [ ] LAUNCH-06 Press and creator kit; contact 30 creators (G8)
- [ ] LAUNCH-07 Launch date set; launch (G8)

## LIVE — Live operations

- [ ] LIVE-01 Weekly metrics review (G9)
- [ ] LIVE-02 Weekly patches for first month (G9)
- [ ] LIVE-03 Monthly devlog (G9)
- [ ] LIVE-04 Region 5 go/no-go from completion + purchase data (G9)
- [ ] LIVE-05 Steam version decision (G9)

---

## Parked — not now

- [-] Online real-time co-op (only if H7 passes)
- [-] Blockchain / on-chain collectibles (only if H8 passes + legal review)
- [-] Regions 5–8
- [-] Operators Farida, Sione, KAI-7
- [-] Vehicle sections, escort and survival missions
- [-] Seasonal pass, PvP, user-generated cosmetics
- [-] Console ports
