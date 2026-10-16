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

Keyboard bindings live in `src/config/controls.ts` (data, with saved overrides; a rebinding
screen is INPUT-05).

| Action                                                     | Keyboard                | Gamepad            | Touch                                |
| ---------------------------------------------------------- | ----------------------- | ------------------ | ------------------------------------ |
| Move / aim (8-way); a light stick tilt walks               | A D / arrows, W S aim   | Left stick / D-pad | Left thumb anywhere on the left side |
| Jump + somersault (down + jump drops through planks)       | Space (also K, Z)       | A                  | JUMP                                 |
| Fire (hold)                                                | J (also X)              | X or RT            | FIRE (hold)                          |
| Prone: hold Down on the ground, or toggle                  | S / Down (hold), C      | Down, LB (toggle)  | stick down                           |
| Dash / dodge (brief invulnerability, one per jump)         | Shift                   | B                  | DASH                                 |
| Weapon slots (1 primary, 2 sidearm, 3 pickup) / cycle      | 1 2 3 / Q               | Y (cycle)          | WPN                                  |
| Reload                                                     | R                       | LT                 | (automatic)                          |
| Relay Swap                                                 | E (also L)              | RB                 | SWAP                                 |
| Swim: up/down to rise and dive, jump = stroke or jump out  | same                    | same               | same                                 |
| Pause                                                      | Esc, P                  | Start              | ‖ (top right)                        |
| Skip insertion (after the first viewing)                   | Space / J / Enter       | A                  | tap                                  |

Touch options in Settings: aim-assist (on by default), auto-fire, controls Auto/On/Off.
Swimming into a quay wall at the surface climbs out automatically. From prone, Jump stands
you up first and then jumps.

## The squad (placeholder numbers)

| Operator | Role       | Health / armour | Weapons (primary + P9 sidearm)           | In water                                | Entry attack on tag-in    |
| -------- | ---------- | --------------- | ---------------------------------------- | --------------------------------------- | ------------------------- |
| Kemi     | Assault    | 3 / 1, fastest  | Kestrel SMG, fast and light              | Floats, 9 s of air, SMG weakened        | Slide-shot burst          |
| Rurik    | Heavy      | 4 / 2, slowest  | Bulwark LMG, heavier rounds              | Sinks and walks the bed; LMG can't fire | Ground-pound              |
| Mei-Lin  | Recon      | 2 / 1           | Needle DMR, slow, hits hard, pierces     | Floats, 12 s of air                     | One piercing shot         |
| Tari     | Amphibious | 3 / 1           | Riptide speargun (full power underwater) | Fastest swimmer, 30 s of air            | Surge dash (rams enemies) |

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

Telemetry events are kept in memory for now (`window.__hotRelay.telemetry.records` in the
browser console). Uploading them is Gate 4 (ANALYTICS-01).

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
