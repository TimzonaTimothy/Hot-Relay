# Hot Relay — Art Generation Prompts

Prompts for concept art, characters, enemies, bosses, environments and UI pieces, styled after
the reference you shared: hand-painted 2D game art with bold ink outlines, cel shading, saturated
colour and deep layered backgrounds. Every subject is original to Hot Relay. Do not name the
reference game or any existing franchise in prompts.

## How to use this file

1. Paste the **Style lock** at the start (or end) of every prompt, so the whole set looks like one game.
2. Add the **Negative prompt** wherever your tool supports one (Stable Diffusion, Flux, Leonardo).
   For tools without one (ChatGPT, Midjourney), append "Avoid: …" with the same list, or use
   Midjourney's `--no`.
3. Generate **concept sheets first**, pick the winners, then use them as image references for the
   in-game assets so faces, colours and gear stay consistent.
4. Keep a seed or reference image per character once you like one.

Suggested settings:

| Tool | Settings |
| --- | --- |
| Midjourney | `--ar 16:9 --style raw --stylize 150` for scenes; `--ar 1:1` for characters; use `--cref` with the approved character image for consistency |
| ChatGPT / GPT image | Ask for a transparent background on characters and props; one subject per image |
| Stable Diffusion XL / Flux | 1344×768 for scenes, 1024×1024 for characters; CFG 5–7; use IP-Adapter or a LoRA trained on approved sheets for consistency |
| Leonardo | "Illustrative" or "Dynamic" preset; enable transparency for sprites |

### Engine note (read before generating sprites)

The current prototype renders at 480×270 pixel-art resolution. This painted style needs more
pixels: plan for a 1920×1080 target with characters about 160–200 px tall on screen. That is a
code change I can make when the art direction is approved; generate at 2–4× that size and
downscale.

---

## Style lock (paste into every prompt)

```
stylized hand-painted 2D video game art, bold clean ink outlines, cel shading with two-tone
shadows, vibrant saturated colours, soft painterly backgrounds with atmospheric depth, crisp
readable silhouettes, side-scrolling run-and-gun action game, 2.5D layered parallax look,
dramatic rim lighting, high detail, professional game key art quality
```

## Negative prompt (paste where supported)

```
photorealistic, 3D render, blurry, muddy colours, low contrast, extra limbs, extra fingers,
deformed hands, duplicate characters, text, watermark, logo, signature, UI elements,
cropped head, cropped feet, busy background on character sheets, real military insignia,
national flags, real brand names, gore
```

---

## 1. Key art and title

### 1.1 Title key art (main menu background)

```
[STYLE LOCK] wide cinematic key art of three elite operators sprinting forward across a
collapsing harbour quay at sunset, a giant automated crane robot looming behind them in smoke,
container stacks and gantry cranes silhouetted against an orange and magenta sky, sparks and
embers in the air, muzzle flashes, the left third of the image kept darker and simpler for a
logo and menu, dynamic low camera angle, 16:9
```

### 1.2 Logo plate (generate, then letter it yourself)

Image tools still misspell words. Generate only the backing plate and set "HOT RELAY" in a real
font afterwards (the game uses Black Ops One).

```
[STYLE LOCK] game logo backing plate, a slanted metallic chevron banner in brushed steel with
an ember-orange glowing edge, three short coloured stripes (amber, steel blue, lime green)
running through it like a relay baton handoff, transparent background, no text, centred
```

---

## 2. Playable operators

Shared gear description so the squad reads as one unit:

```
modern special-response tactical gear, plate carrier with modular pouches, fingerless gloves,
knee pads, helmet with a coloured visor band in their personal colour, a small three-chevron
relay unit patch on the shoulder (original emblem, no real insignia), practical and
professional, not sexualised
```

### 2.1 Character concept sheets (one per operator)

Use this template, then fill in each operator's block below.

```
[STYLE LOCK] character design sheet of [OPERATOR BLOCK], [SHARED GEAR], full body front view,
side view facing right, and back view, plus three facial expressions (focused, shouting,
smirking) and a close-up of their weapon, neutral light grey background, consistent proportions
across views, game-ready silhouette
```

**Kemi Adeyemi, Assault (colour: amber orange)**

```
Kemi Adeyemi, Nigerian woman in her late twenties, athletic sprinter build, dark brown skin,
braided hair tied back under the helmet, red headband, determined grin, amber orange visor band
and accents, light armour for speed, carrying a compact submachine gun with a vertical magazine,
low ready stance leaning forward like she is about to sprint
```

**Rurik Valdsson, Heavy (colour: steel blue)**

```
Rurik Valdsson, Scandinavian man in his forties, broad and tall, fair skin, short copper-brown
beard, calm eyes, steel-blue visor band and accents, heavy shoulder plates and a reinforced
front shield panel on his forearm, carrying a long light machine gun with a box magazine and a
folded bipod, planted wide stance, gentle-giant expression
```

**Mei-Lin Tsao, Recon / Marksman (colour: lime green)**

```
Mei-Lin Tsao, Taiwanese woman in her early thirties, lean build, black hair in a high ponytail,
light-medium skin, sharp focused expression, lime green visor band and accents, a glowing green
monocle scope over one eye, light recon armour with a ghillie-style scarf, carrying a long slim
designated marksman rifle with a large scope, crouched aiming pose
```

**Later operators (only after they are validated in playtests):**

- **Tomás Arriaga, Engineer (colour: yellow):** `Mexican man in his thirties, stocky, moustache, tool belt and a deployable turret backpack, welding goggles pushed up on the helmet, carrying a carbine`
- **Farida Haddad, Demolition (colour: red):** `Moroccan woman in her thirties, wiry build, short curly hair, bandolier of grenades, blast-resistant collar, carrying a grenade launcher`
- **KAI-7, Experimental (colour: cyan):** `humanoid combat android with a sleek white and cyan shell, a glowing energy-absorbing chest core, no face, a single horizontal light visor`

### 2.2 In-game character sprites (per operator)

```
[STYLE LOCK] [OPERATOR BLOCK], [SHARED GEAR], full body, side view facing right, in-game sprite
for a 2D side-scrolling shooter, [POSE], clean silhouette, even lighting with a light rim on the
back edge, transparent background, character fills 85% of the frame height, no shadow on the
ground
```

Generate one image per `[POSE]`:

| Pose | Prompt text |
| --- | --- |
| Idle | `standing ready, weapon held level, slight forward lean` |
| Run (key frame) | `mid-sprint, one knee high, weapon held level and steady` |
| Jump | `mid-air jump, knees tucked, weapon pointed forward` |
| Aim up | `standing, weapon pointed straight up` |
| Aim diagonal up | `standing, weapon angled 45 degrees upward` |
| Aim diagonal down | `standing, weapon angled 45 degrees downward` |
| Crouch / prone fire | `kneeling low, firing forward` |
| Hit | `recoiling from a hit, flinching backwards` |
| Down | `falling backwards, knocked out` |
| Tag-in (entry attack) | Kemi: `sliding along the ground firing forward`; Rurik: `slamming the ground with a fist, shockwave rings`; Mei-Lin: `firing a single glowing green piercing shot, long muzzle trail` |

Full animation cycles (8–12 frames for runs) need an animator or a tool built for sprite
animation. Image generators do not keep frames consistent enough. Use these key poses as the
animator's brief.

### 2.3 HUD portraits

```
[STYLE LOCK] close-up head and shoulders portrait of [OPERATOR BLOCK], three-quarter view facing
right, confident expression, bold outline, strong rim light in their personal colour, plain
dark navy background, square 1:1, video game HUD portrait
```

---

## 3. Story characters (briefings and cutscene panels)

**Dr Amara Bello, mission handler**

```
[STYLE LOCK] portrait of Dr Amara Bello, Nigerian woman in her fifties, short natural grey-black
hair, reading glasses, headset microphone, smart field jacket over a shirt, calm and authoritative
expression, standing in a mobile command centre with glowing tactical screens behind her, 16:9
briefing panel
```

**Ifeoma Nwosu, harbour engineer (Port Ileya ally)**

```
[STYLE LOCK] portrait of Ifeoma Nwosu, Nigerian woman in her thirties, hard hat, high-visibility
orange vest over overalls, tablet in hand, confident engineer, standing on a harbour quay with
cranes behind her at dusk, 16:9 briefing panel
```

**Calloway Strand, antagonist CEO**

```
[STYLE LOCK] portrait of Calloway Strand, tall man in his sixties, silver slicked-back hair,
tailored charcoal suit with a thin glowing circuit-pattern lapel pin, cold polite smile,
standing in a glass penthouse overlooking a harbour full of automated cranes at night,
corporate villain, 16:9
```

---

## 4. Enemies — Nullward Corporation and the Lattice

Enemy look rule: grey and ember-red palette, a hexagonal orange "Lattice" eye light on every
machine, so players read them as hostile at a glance. Contractors wear the same grey uniforms
with orange visor slits.

```
[STYLE LOCK] [ENEMY BLOCK], side view facing left, in-game enemy sprite for a 2D side-scrolling
shooter, clean silhouette, transparent background, Nullward corporate grey and ember-red colour
scheme, glowing orange hexagonal sensor light
```

| Enemy | `[ENEMY BLOCK]` |
| --- | --- |
| Contractor rifleman | `private military contractor in a grey armoured uniform and full-face helmet with a glowing orange visor slit, holding an assault rifle aimed forward` |
| Riot contractor | `heavily armoured contractor holding a large riot shield with a small viewing slot, short baton, crouched behind the shield` |
| Dock Crawler | `crab-like quadruped maintenance drone the size of a dog, four jointed legs with magnetic feet, a small turret on its back, scuttling` |
| Skitter swarm | `group of six tiny spherical rolling drones with spiked wheels and single orange eyes, cute but menacing` |
| Gantry sniper | `mounted sniper turret bolted to a steel gantry, long barrel, a red laser sight beam` |
| Jetpack lancer | `contractor flying with a jetpack, diving forward with a charged energy lance, flame trails` |

---

## 5. Bosses (region 1)

**Harbour Mule (mini-boss)**

```
[STYLE LOCK] mini-boss for a 2D side-scrolling shooter, a hulking four-legged cargo walker robot
carrying stacked shipping containers on its back, hydraulic legs, a crane arm that hurls
containers, grey and ember-red Nullward paint, glowing orange hexagonal eyes, side view facing
left, harbour quay at dusk behind, sparks and steam
```

**The Dredger (region 1 boss, three phases)**

```
[STYLE LOCK] giant boss for a 2D side-scrolling shooter, a half-submerged dredging ship turned
into a war machine, an enormous mechanical dredge arm with a bucket-wheel of teeth, mortar
cannons on the deck, a glowing orange reactor core behind armour plates, rising seawater crashing
around it, harbour at sunset, side view facing left, epic scale, smoke and spray
```

Phase variants (add to the end of the prompt):

- Phase 1: `dredge arm sweeping low across the quay`
- Phase 2: `deck mortars firing upward in an arc, shells in the sky`
- Phase 3: `armour plates blown open revealing the glowing core, tide rising, ship listing`

---

## 6. Environments

Every environment is generated as **separate parallax layers** so the engine can scroll them at
different speeds, matching the reference's depth. Use this layer template for each region:

```
[STYLE LOCK] side-scrolling game background layer, [LAYER], [REGION BLOCK], seamless and
horizontally tileable, wide 21:9 format, no characters, no text
```

| `[LAYER]` | Content and use |
| --- | --- |
| `far sky layer` | Sky, sun, clouds, distant silhouettes. Scrolls slowest |
| `distant background layer, transparent sky` | Far skyline or landforms. Soft and desaturated |
| `midground layer, transparent sky` | Main scenery with detail. Moderate saturation |
| `near background layer, transparent sky` | Large dark shapes close to the play area |
| `foreground overlay layer, mostly transparent, dark silhouettes at the bottom edge only` | Plants, posts or rubble drawn in front of the action |

Then a ground tile set for the playable surfaces:

```
[STYLE LOCK] 2D platformer ground tile set for [REGION BLOCK], side view, includes a flat ground
top edge, a left edge cap, a right edge cap, a floating thin platform, a raised block, and a
breakable crate, top surfaces show depth with a lit front lip, seamless, transparent background,
arranged on a grid sheet
```

### Region blocks

**Region 1 — Port Ileya (Gulf of Guinea coastal megacity, the launch region)**

```
a busy West African coastal port megacity at golden-hour sunset, gantry cranes and colourful
container stacks, a modern skyline with mixed high-rise and older low-rise buildings, mangrove
inlets at the edges, palm trees, warm orange and teal water reflections, harbour lights coming on,
the port seized by grey Nullward robots
```

Play-surface materials: concrete quay with yellow safety paint, corrugated shipping containers,
steel catwalks with railings, wooden jetty planks over water.

**Region 2 — Erg Saar Array (Saharan solar desert)**

```
vast golden sand dunes with an enormous solar mirror array stretching to the horizon, a central
receiver tower glowing white-hot, heat shimmer, a sandstorm wall approaching in the distance,
weathered stone outposts
```

**Region 3 — Kessler Works (Central European rail and steel city)**

```
an industrial European steel city at dusk, blast furnaces and smokestacks, rail yards with
freight trains, brick factory halls, orange molten-steel glow, light rain and wet reflections
```

**Region 4 — Saikō Tiers (East Asian vertical megacity)**

```
a dense vertical East Asian megacity at night, stacked residential towers and elevated maglev
rails, neon signs with abstract symbols (no readable text), glass skybridges, glowing gravity
lift shafts, light rain
```

**Region 5 — Karakhal Pass (South Asian high mountains)**

```
towering snow-capped Himalayan-style peaks, a narrow mountain pass with cable cars and prayer
flag strings, stone and timber mountain huts, clouds below the cliffs, strong wind and blowing snow
```

**Region 6 — Station Nordvakt (Arctic installation)**

```
a remote Arctic research and defence station on pack ice, radar domes, snow-covered hangars,
cracked blue ice, aurora borealis in a deep night sky, harsh white spotlights
```

**Region 7 — Rio Verde Canopy (South American rainforest station)**

```
dense South American rainforest, giant trees with buttress roots, waterfalls and misty river
gorges, a research station on stilts with rope bridges, bioluminescent plants in the shadows,
ancient overgrown stone ruins, toucans and macaws
```

This region is closest to your reference image: lush jungle, waterfalls, ruins and crumbling
stone walkways over water.

**Region 8 — Ashfall Atoll (Pacific island and underground core)**

```
a volcanic Pacific atoll with black sand beaches and palm trees, a smoking volcano, a hidden
high-tech facility built into the crater, glowing orange-red lava channels and the cyan glow
of an enormous machine core deep underground
```

### Full-scene mood shots (for pitching and the store page)

```
[STYLE LOCK] in-game screenshot mockup of a 2D side-scrolling run-and-gun shooter, [REGION BLOCK],
an operator in the foreground left firing a rifle with a bright muzzle flash, two enemy soldiers
mid-distance on stone walkways, layered parallax depth, foreground plants framing the edges,
16:9, no UI
```

---

## 7. Weapons, pickups and effects

**Weapon icons (HUD and loadout screen)**

```
[STYLE LOCK] game weapon icon, [WEAPON], side view, clean silhouette with bold outline, slight
ember-orange rim light, transparent background, centred, isolated
```

| Weapon | `[WEAPON]` |
| --- | --- |
| Kestrel SMG | `compact futuristic submachine gun with a vertical magazine and short barrel` |
| Bulwark LMG | `heavy light machine gun with a box magazine and folding bipod` |
| Needle DMR | `long slim marksman rifle with a large scope and green energy accents` |
| Breacher shotgun | `pump-action combat shotgun with a drum magazine` |
| Tremor launcher | `stubby revolver-cylinder grenade launcher` |
| Harmattan (legendary) | `ornate desert-camo burst rifle with brass inlays and a sand-coloured energy core` |

**Field pickup crates**

```
[STYLE LOCK] floating weapon pickup capsule for a 2D shooter, a small armoured crate with a
glowing [COLOUR] holographic symbol of [SYMBOL] on its face, hovering with a soft light beam,
transparent background
```

Use colours and symbols: Fan `orange, five spreading lines`; Arc Lance `electric blue, lightning
bolt`; Hornet `red, homing arrow`; Furnace `deep orange, flame`; Rail `white, single long beam`.

**Effect sheets**

```
[STYLE LOCK] 2D game visual effects sprite sheet on a black background, [EFFECT], 6 stages in a
row from start to finish, bold cel-shaded shapes, bright additive colours
```

Effects: `rifle muzzle flash`, `bullet impact sparks on metal`, `robot explosion with debris`,
`ground-pound shockwave ring with dust`, `blue tag-in energy ring`, `water splash`.

---

## 8. UI pieces

**HUD squad frame**

```
[STYLE LOCK] video game HUD frame element, a slanted gunmetal panel with a square portrait slot
on the left, three thin segmented gauge bars, ember-orange glowing edge trim, subtle scratches,
transparent background, no text, flat front view
```

**Menu button plates (normal and selected)**

```
[STYLE LOCK] video game menu button, a slanted parallelogram gunmetal plate with a beveled edge,
[STATE], transparent background, no text, flat front view
```

States: `dark navy unselected with a thin steel outline` and `glowing ember-orange selected with a light streak`.

**Touch control buttons**

```
[STYLE LOCK] mobile game touch control button, round dark glass button with an ember-orange
ring, white [ICON] icon in the centre, transparent background, flat front view
```

Icons: `upward double chevron (jump)`, `crosshair (fire)`, `two circling arrows (swap)`, `pause bars`.

---

## 9. Consistency checklist before an image goes in the game

- [ ] The silhouette reads at 25% size (squint test)
- [ ] The personal colour (amber, steel blue, lime) is visible on helmet visor band and accents
- [ ] It faces right for operators, left for enemies (the engine flips them)
- [ ] Background is transparent for characters, props and effects
- [ ] No text, logos, real insignia or flags crept in
- [ ] Hands and weapon grip look correct (regenerate or fix by hand if not)
- [ ] A cultural reader from the region has seen region and ally art before release (ART-10)

## 10. Licensing note

Check your image tool's terms for commercial use before shipping any generated art, and keep a
record of the prompts and tools used for each asset. Generated images are best treated as
concept art and briefs for an artist; final in-game sprites usually need cleanup by hand for
consistency and animation.