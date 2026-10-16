# Asset register — what is placeholder, and what replaces it

Everything you see and hear in this build is **generated in code at boot**. None of it is
final art or audio. It is drawn in one consistent style (cel-shaded, ink-outlined, dusk
palette) so the vertical slice can be judged as a whole, but every item below is a
placeholder. Final assets must keep the **same texture keys, pivots and sizes** so no gameplay
code changes when they land.

Status key: **P** = placeholder in the build · **F** = final (none yet).

## Characters (src/art/characters.ts)

Cut-out rig parts, drawn at 6 px per world px. Pivots are listed in `PARTS`.

| Key pattern                                            | Contents                                                                             | Final asset needed                                                                          | Status |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------ |
| `<rig>-head`, `<rig>-torso`, `<rig>-leg`, `<rig>-legB` | Kemi, Rurik, Mei-Lin, Tari, contractor                                               | Painted parts per character, same pivots (hip at leg top, neck at head base)                | P      |
| `<rig>-arm-<weapon>`                                   | Gun arm per operator weapon (kestrel, bulwark, needle, riptide, p9, contractorRifle) | Painted arm + weapon per weapon; barrel tip at `WEAPONS[id].muzzle` units from the shoulder | P      |
| `portrait-<id>` (src/ui/artGen.ts)                     | 16×16 HUD portraits                                                                  | Painted portraits, 64×64 or larger                                                          | P      |

Animation is procedural (poses blended per state in `src/entities/Rig.ts`). If hand-made
animation replaces it, keep the state names in `src/systems/anim.ts`: idle, walk, run, jump,
aim, shoot, runShoot, takeoff, flip, fall, land, proneEnter, prone, proneShoot, proneExit, slide,
dash, hurt, dead, victory, rope, swimSurface, swimUnder, climb.
Reload and recoil are layered on the arm.

## Effects, hazards, helicopter (src/art/fx.ts)

| Key                                                  | Contents                                   | Final asset needed                                         | Status |
| ---------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- | ------ |
| `fx-flash`                                           | Muzzle flash                               | 3–4 frame flash sheet per weapon class                     | P      |
| `fx-casing`                                          | Brass casing                               | Casing sprite (2 frames spin)                              | P      |
| `fx-shadow`                                          | Contact shadow                             | Can stay procedural                                        | P      |
| `fx-dust`, `fx-drop`, `fx-bubble`                    | Dust, droplets, bubbles                    | Particle sheets                                            | P      |
| `fx-tuft`                                            | Grass tuft that bends in wind / rotor wash | 2–3 foliage variants                                       | P      |
| `mine`, `mine-lamp`                                  | Tethered naval mine                        | Painted mine + lamp glow                                   | P      |
| `eel`, `eel-eye`                                     | Eel drone                                  | Painted drone, 4-frame swim cycle                          | P      |
| `grate`, `cache`                                     | Breakable grate, supply cache              | Painted props + broken-grate debris                        | P      |
| `heli-body`, `heli-rotor`, `heli-blade`, `heli-tail` | Insertion helicopter                       | Painted helicopter; door anchor at (58, 27) in 96×40 units | P      |
| `hitbox`                                             | Invisible 12×20 physics frame              | Stays (not art)                                            | —      |

## Stage (src/art/stageArt.ts, src/ui/artGen.ts)

| Key                                                              | Contents                                                                                                         | Final asset needed                                   | Status      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| `plat-<stage>-<n>`                                               | Each platform painted at boot (quay walls with grass lips and bollards, containers, catwalks, pontoons, sea bed) | Tiled tileset + props (LEVEL-02)                     | P           |
| `bg-far`, `bg-mid`, `bg-near`, `water`                           | Parallax skyline, cranes, dock (pixel style from the menu)                                                       | Painted parallax layers matching the character style | P           |
| `glow`, `vignette`, `scan`                                       | Light and screen overlays                                                                                        | Can stay procedural                                  | P           |
| Water surface, depth tint, light shafts (src/stage/WaterView.ts) | Procedural                                                                                                       | Optional shader or painted caustics                  | P           |
| Checkpoint flags, goal flag                                      | Plain rectangles                                                                                                 | Painted flag props                                   | P (greybox) |

## Audio (src/systems/Sfx.ts)

All sounds are synthesised with Web Audio (no files).

| Sound                                                                  | Final asset needed                                 | Status   |
| ---------------------------------------------------------------------- | -------------------------------------------------- | -------- |
| Shots (per weapon pitch), enemy shots, hits, deaths, jump, swap, pound | Recorded/designed SFX per weapon and event         | P        |
| Splash (small/big), climb, bubbles                                     | Water foley set                                    | P        |
| Reload, reload done, dry fire, weapon switch                           | Weapon handling foley                              | P        |
| Gasp, air warning                                                      | Breath and warning cue                             | P        |
| Explosion (mines)                                                      | Underwater + surface explosion                     | P        |
| Helicopter rotor loop (noise chopped at ~11 Hz + turbine hum)          | Looping rotor recording with Doppler-friendly fade | P        |
| Music                                                                  | Stage theme, insertion sting                       | none yet |

## Fonts (bundled, final)

Black Ops One, Teko, Chakra Petch via @fontsource (SIL Open Font License). Bundled with the
build, so they work offline.
