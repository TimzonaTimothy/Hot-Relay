# Hot Relay

Tag-team run-and-gun for the browser. Pick three of four operators; one is on the field at a
time, and **Relay Swap** tags the next one in with an entry attack. Installs as a PWA and plays
offline.

This is the **Gate 3 prototype plus the character vertical slice**: a helicopter insertion,
cut-out animated characters, weapons with magazines, swimming with air and drowning, a flooded
basin with underwater hazards and a secret, all on one stage. **All art and sound is
placeholder** generated in code (listed in `ASSETS.md`). The prototype's job is to answer
these questions with real players before any money goes into art (see the plan doc):

- **H1** — do web players stay 3+ minutes?
- **H2** — is the Relay Swap fun, or just a gimmick? (A/B: `?mode=solo`)
- **H4** — are touch controls good enough? **H10** — does it run at 60 fps on a mid-range phone?

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm run preview   # production build with offline support, http://localhost:4173
```

## Controls

| Action                                                    | Keyboard       | Gamepad            | Touch                                |
| --------------------------------------------------------- | -------------- | ------------------ | ------------------------------------ |
| Move / aim (8-way); a light stick tilt walks              | Arrows or WASD | Left stick / D-pad | Left thumb anywhere on the left side |
| Jump (down + jump drops through planks)                   | Z, Space, K    | A                  | JUMP                                 |
| Swim: up/down to rise and dive, jump = stroke or jump out | same           | same               | same                                 |
| Fire                                                      | X, J           | X or RT            | FIRE (hold)                          |
| Switch weapon                                             | Q, V           | Y or LB            | WPN                                  |
| Reload                                                    | R              | LT                 | (automatic)                          |
| Relay Swap                                                | C, L, Shift    | B or RB            | SWAP                                 |
| Pause                                                     | Esc, P         | Start              | ‖ (top right)                        |
| Skip insertion (after the first viewing)                  | Z / X / Enter  | A                  | tap                                  |

Touch options in Settings: aim-assist (on by default), auto-fire, controls Auto/On/Off.
Swimming into a quay wall at the surface climbs out automatically.

**Jumping.** A running jump tucks into a somersault: a fixed, slightly higher arc you can still
steer, with a small hitbox for slipping between shots. Firing mid-somersault opens up into the
aim pose for the rest of the jump. A standing jump stays upright, and releasing jump early makes
it lower. Press jump again in mid-air for a double jump (always a quick flip).
View zoom (normal / wide / close): O key, gamepad Back, or the zoom button on touch.

## The squad (placeholder numbers)

| Operator | Role       | Health / armour | Weapons (primary + P9 sidearm)           | In water                                | Entry attack on tag-in    |
| -------- | ---------- | --------------- | ---------------------------------------- | --------------------------------------- | ------------------------- |
| Kemi     | Assault    | 3 / 1, fastest  | Kestrel SMG, fast and light              | Floats, 9 s of air, SMG weakened        | Slide-shot burst          |
| Rurik    | Heavy      | 4 / 2, slowest  | Bulwark LMG, heavier rounds              | Sinks and walks the bed; LMG can't fire | Ground-pound              |
| Mei-Lin  | Recon      | 2 / 1           | Needle DMR, slow, hits hard, pierces     | Floats, 12 s of air                     | One piercing shot         |
| Tari     | Amphibious | 3 / 1           | Riptide speargun (full power underwater) | Fastest swimmer, 30 s of air            | Surge dash (rams enemies) |
| Tomás    | Engineer   | 3 / 1           | Forge carbine (weak)                     | 8 s of air, carbine weakened            | Sentry drop: a turret fights for 9 s |
| Farida   | Demolition | 3 / 1           | Tremor launcher: lobbed grenades with splash, arm after a short flight (useless point-blank) | Launcher can't fire; 8 s of air | Blast jump (hurts enemies only) |
| Sione    | Support    | 3 / 2           | Tala shotgun, 5 short-range pellets      | Good swimmer, 14 s of air               | Shield pulse: clears enemy fire, stuns, +1 armour to the squad |
| KAI-7    | Experimental | 2 / 3, fast   | Volt repeater, fast light bolts          | Android: sinks slowly, 60 s before damage | Phase dash through enemies |

Traits: while **Sione** is in the squad (benched or active) the bench regains armour 1.75× faster.
**KAI-7** turns every 3 armour hits into a counter-blast of 10 bolts, but loses 1 armour every 6 s
while active; it unlocks after the first stage clear. The squad screen shows four operators a page.

Benched operators regain armour and air. When the active operator goes down, the next one tags
in automatically; the run fails only when all three are down (retry from the last checkpoint).

## Playtest links

Deploy `dist/` anywhere static (GitHub Pages via the included workflow, itch.io, Netlify), then:

- Relay build: `https://<your-host>/`
- Solo build for the H2 comparison: `https://<your-host>/?mode=solo`
- Stress test on a phone (H10): `https://<your-host>/?stage=stress` — pass is median ≥ 55 fps,
  slowest-10% ≥ 45 fps
- Debug overlay: add `?debug=1` (also makes the insertion skippable and adds `window.__hotRelay.debug` hooks)
- Pick the squad: `?squad=tari,kemi,rurik` · force the opening cinematic: `?insertion=play` (or `skip`)

### Running a playtest (TEST-02 / TEST-03)

Send testers the link with `?playtest=1` added (for H2, half of them also get `&mode=solo`).
Playtest mode is remembered on their device until `?playtest=0`.

1. Every stage attempt is recorded on the device: cleared or quit, play time, time to first
   fight, operators down per section, swaps per minute, the control they mostly used, fps and
   whether it was a replay.
2. After each cleared stage a 3-question survey appears (fun 1–5, controls 1–5, play another
   stage?). Skip is always available.
3. When they're done: **Menu → Playtest data → Download file** (or **Copy results** and paste
   it into a message). The screen also shows the Gate 4 numbers for that device.

The file starts with a summary (3-minute sessions, clear rate by control for H4, relay vs solo
and swaps per minute for H2, survey averages), followed by every run. Nothing is uploaded:
there is no backend until Gate 4 passes. Telemetry events are also in memory
(`window.__hotRelay.telemetry.records`); uploading them is ANALYTICS-01.

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run e2e   # headless: menu → squad select → insertion, bot clears the stage (swims the basin),
              # swimming/climbing/sinking/drowning, weapons, pause, solo, touch, phone insertion,
              # stress, offline launch
```

`npm run e2e` needs Chromium: `npx playwright install chromium`, or point `CHROME_PATH` at one.

## Deploying

`.github/workflows/ci.yml` runs every check on each push and deploys `main` to GitHub Pages.
In the repo settings, set **Pages → Source** to **GitHub Actions** once.
