# Contra-Inspired Browser Shooter — Research & Validation Plan

Oct 14, 2026 · @Agbo Uchenna David

## Platform decision and working assumptions

The game ships first as a browser game that installs as a PWA: the whole campaign plays offline once downloaded, and an online layer adds accounts, cloud saves, leaderboards, challenges and purchases. Every recommendation below is built around that constraint.

**Works fully offline (after first load):** downloaded campaign stages, local saves, character and weapon progression earned in play, practice and score-attack runs, local 2-player co-op on one device (keyboard + gamepad).

**Needs a connection:** account and cross-device cloud save, leaderboards and daily/weekly challenges, store purchases, downloading new regions and event content, online co-op (later, only if validated).

Why browser + PWA suits this project:

- **Zero-install reach.** A link starts the game; web portals such as Poki and CrazyGames carry large audiences (section 2).
- **Nigeria-friendly.** Mobile data there is among the cheapest in the world, about $0.38–0.42 per GB ([Intelpoint](https://intelpoint.co/insights/1gb-of-data-in-the-us-costs-15-times-more-than-in-nigeria/), [TechCabal](https://techcabal.com/2026/02/09/how-nigerians-spent-%E2%82%A620-87billion-daily-on-data-in-2025/)), but 2G still made up about 36% of mobile connections in May 2026, so the first download must stay small and offline play matters.
- **Payments you control.** Web checkout avoids app-store fees and the reported problem that many Naira cards cannot pay for in-app purchases abroad (section 9).

Working assumptions (correct any that are wrong):

- Team: you, solo, building with Claude Code; art and audio contracted per asset.
- Skills reused from your stack: TypeScript, Python/FastAPI, PostgreSQL, Docker, Railway.
- Budget: self-funded and lean; the prototype costs under about $3,000 cash.
- Prior shipped games: none assumed, so the plan front-loads feel and feasibility tests.
- First markets: global web players on desktop and Android, with Nigeria and West Africa as a home market.

## 1. Executive assessment

This is a viable project as a small, sharp browser-first run-and-gun built around one signature mechanic. It is not viable, for a solo developer, as the feature list in the brief: eight characters, eight countries, a marketplace, blockchain and online multiplayer would take a funded team years.

- **Demand exists, but it rewards feel, not nostalgia.** Indie run-and-guns and action-platformers have sold in the millions: Dead Cells passed 10 million, Broforce 7 million, Cuphead 5 million in its first two years. Konami's own 2024 reboot, Contra: Operation Galuga, is estimated at only about 28,000–37,000 Steam copies by third-party trackers. A famous name did not carry it; controls, art and identity did carry the others.
- **The browser is a real channel again.** Poki and CrazyGames serve tens of millions of monthly players and share ad revenue with developers. Their players expect play within seconds and short sessions, which favours short, dense stages.
- **The hardest technical problem is touch controls.** Precise 8-way shooting and jumping on a phone screen is where most mobile run-and-guns lose players. It must be tested in week 2, not month 6.
- **Recommended concept: "Hot Relay"** — a three-operator strike team you tag in and out mid-fight, across 2–4 minute stages, starting with one West African coastal region (sections 3–4).
- **Blockchain stays out of version 1.** Player value is unproven, the regulatory and platform picture is hostile, and 2025 saw a wave of blockchain-game shutdowns (section 8). Revisit only after launch and only for optional cosmetics.
- **Money model:** free first region (portal ads, optional rewarded video), a one-time full-campaign unlock on your own site, cosmetic packs, and later paid regions. No premium currency, no loot boxes, no pay-for-power.
- **Decision window:** a playable one-stage prototype in about 3 weeks and a validated vertical slice in about 12 weeks tell you whether to continue, pivot or stop before real money is spent.

## 2. Competitor and market analysis

The winners in this space share three things: controls that feel instant, a visual identity you recognise from one screenshot, and a reason to replay beyond the story. Sales figures below are labelled by source type; "estimate" means a third-party tracker, not the developer.

| Game | What is verified | What works | Where it gets repetitive | Retention and money |
| --- | --- | --- | --- | --- |
| [Contra: Operation Galuga](https://www.co-optimus.com/review/2492/page/1/contra-operation-galuga-co-op-review.html) (2024) | $39.99; 8 stages; co-op up to 2 in story, 4 in arcade. Steam estimates: about 28K ([SteamPulse](https://www.steampulse.org/game/2235020)) to 37K copies ([Raijin](https://raijin.gg/app/2235020/Contra_Operation_Galuga)) | Classic patterns, weapon level-ups, an "Overload" special per weapon | Short campaign; one reviewer found the Switch controls laggy ([TouchArcade](https://toucharcade.com/?p=320603)) | Premium; perk shop and challenge mode |
| Metal Slug | Free-to-play spin-offs Attack and Defense ended service in 2023 ([Boss Rush](https://bossrush.net/2022/11/07/free-to-play-games-metal-slug-attack-and-defense-to-end-service-early-2023/)); Tencent/TiMi's Awakening launched free-to-play on mobile in 2024 with 3-player co-op, roguelike challenges and PvP ([iPhoneSoft](https://iphonesoft.fr/2024/07/19/legendaire-metal-slug-retour-awakening)) | Animation humour, vehicles, prisoner rescues | Arcade length; mobile versions lean on gacha-style progression | Live-service mobile titles have a finite life |
| [Broforce](https://gonintendo.com/contents/23872-sales-milestones-shared-for-broforce-fuga-melodies-of-steel-and-pinball-fx) | Publisher figure: 7 million copies worldwide. Started as a 2012 game-jam entry ([Daily Investor](https://dailyinvestor.com/technology/146088/the-south-african-game-studio-that-made-r172-million-with-its-first-game/)) | Fully destructible terrain; rescuing a prisoner swaps you to a random hero; chaotic co-op | Level structure late in the game | Premium plus years of free updates |
| Huntdown (2020) | Metacritic 86; 20 levels, 3 characters, local co-op ([Deku Deals](https://www.dekudeals.com/items/huntdown)). No public sales figure; SteamSpy estimates 20K–50K Steam owners ([SteamSpy](https://www.steamspy.com/dev/Easy+Trigger+Games)) | Cover mechanic, gang-boss personalities, 80s style | Linear stages, limited replay hooks | Premium. Lesson: excellent craft alone does not guarantee scale |
| [Dead Cells](https://gamespress.com/Dead-Cells-Has-Sold-More-Than-10-Million-Copies) | 10 million+ copies in six years, 34 free updates, 4 paid DLCs. Mobile version alone passed 5 million ([80 Level](https://cdn.80.lv/articles/dead-cells-mobile-sales-surpass-5-million-copies/)) | Runs that differ every time, permanent unlocks, streamable mastery | Early biomes on repeat runs | Premium + long update tail + paid DLC |
| [Cuphead](https://cur.at/gH2VlnV?m=web) | 1 million in two weeks, 5 million in two years | Unmistakable art direction; boss fights as the core content | Boss retries can frustrate casual players | Premium + one paid DLC |

**1. What we can learn without copying.** Enemies telegraph clearly before they attack. Pickups change *how* you play, not just damage. Stages are short and dense. Bosses test what the stage taught. Co-op turns mistakes into comedy.

**2. What creates long-term replay.** Variation between attempts (Dead Cells), skill ranks and score attack, unlocks earned by mastery rather than time, co-op, and a steady update stream (Dead Cells' 34 free updates).

**3. Why players abandon action games** (assumptions to test, not facts): difficulty spikes that do not teach; controls that feel late; repeated content with no new decisions; grind walls; and, specific to the browser, slow loading. Poki's COO says the most successful web games are playable in under three seconds ([PocketGamer.biz](https://www.pocketgamer.biz/inside-pokis-vision-for-the-future-of-browser-gaming/)).

**4. What could differentiate this game.** One signature mechanic (the Relay Swap), instant link-to-play with true offline play, stages sized for a phone session, an African-led cast opening in West Africa within a respectful global campaign, and an economy that never sells power.

**5. Who to target first.** Desktop web players on portals who already play action games, and Android mobile-web players in Nigeria and West Africa. Retro run-and-gun fans are a valuable but small second audience for community and word of mouth.

**6–7. Which platform first.** Browser + PWA, desktop and Android Chrome first, iOS Safari supported but secondary.

| Platform | Build cost for you | Discoverability | Monetization | Feasibility now |
| --- | --- | --- | --- | --- |
| Browser + PWA (recommended) | Low: TypeScript, your stack | High via portals; links share well | Portal ad share; own-site checkout; no app-store cut | High |
| Android native app | Medium: wrapper or rebuild | Play Store search is crowded | Google Play billing on digital goods | Medium; later via a wrapper |
| iOS native app | Medium-high | App Store search is crowded | Apple in-app purchase required for digital unlocks | Low priority |
| Steam (PC) | Medium: desktop wrapper | Strong for premium action games; needs wishlists | Premium sales | Good second step; bans blockchain games (section 8) |
| Consoles | High: dev kits, certification, porting | Strong | Premium | Only after proven success |

Poki pays developers 100% of ad revenue from traffic they bring and 50% from traffic Poki brings ([Poki for Developers](https://sdk.poki.com/)). CrazyGames does not publish a fixed split in its main docs and reports over 50 million monthly players ([CrazyGames guide](https://app.cinevva.com/guides/publish-game-crazygames)). Treat both as distribution and test labs, not as a whole business: Poki says its best games earn up to €1 million a year, which is the top of a long tail ([Mobidictum](https://mobidictum.com/?p=209499)).

## 3. Three original game concepts

All three share an original universe: in the 2040s, logistics giant Nullward Corporation's automated defence network, the Lattice, seizes military hardware across eight regions. What differs is the format, the signature mechanic and the cost.

| Field | A. Hot Relay | B. Scrapfire | C. Skyline Siege |
| --- | --- | --- | --- |
| Core fantasy | Lead a three-operator strike team and tag them in mid-fight | Raid Lattice scrapyards and build absurd hybrid guns from what you find | Fight up a collapsing megastructure with three friends |
| Unique selling point | **Relay Swap**: instant tag-in with an entry attack; benched operators recover armour; losing one operator is not game over | **Weapon Fusion**: carry two pickups and fuse them into a hybrid (spread + beam = fan of lasers) | Destructible floors drop the squad into new sections; built for 4-player online co-op |
| Target audience | Web and mobile action players 13–34; retro fans | Roguelite players who like short runs and build-crafting | PC co-op groups |
| Art direction | Crisp hi-bit pixel art at 480×270, bold silhouettes, warm coastal palette for region 1 | Chunky pixel art, junkyard colour, readable at small sizes | 2.5D: 3D models on a side view, cinematic lighting |
| Story premise | Relay Team, an independent rapid-response unit, cuts the Lattice node by node across 8 regions | Salvage crews strip the Lattice for parts; light story between runs | One tower, one night; the Lattice's core is at the top |
| Protagonists | Kemi Adeyemi (assault), Rurik Valdsson (heavy), Mei-Lin Tsao (recon); handler Dr Amara Bello | Three salvager crews, picked per run | Four squad members, cosmetic variety |
| Antagonist and factions | Calloway Strand, Nullward's CEO; Lattice machines, Nullward contractors, rogue AI "Echo" | Scrapyard Lattice wardens | Lattice tower defence systems |
| Core loop | Pick 3 operators → 2–4 min stage → earn Scrip and medals → upgrade → next stage or replay for rank | Start run → rooms → fuse weapons → die or win → permanent unlocks | Matchmake → climb → loot cosmetics → repeat |
| Weapon system | Operator sidearm + Contra-style field pickups + one loadout weapon | Pickups only; fusion recipes | Class weapons + loot |
| Mission structure | Hand-built stages: 3 stages + 1 boss per region | Procedurally assembled rooms; daily seed | One long level in floors |
| Progression | Operator levels, weapon mastery, medals, unlockable operators | Meta unlocks expand the pickup pool | Account level, cosmetics |
| Multiplayer | Local 2-player co-op first; ghosts and leaderboards online; real-time co-op later | Daily leaderboard; co-op later | Online co-op is the product |
| Monetization | Free region 1; paid campaign unlock; cosmetics; paid regions | Premium unlock + cosmetics | Free-to-play with cosmetics and season pass |
| Blockchain suitability | Low; optional cosmetic collectibles at most | Low | Medium for cosmetics, but irrelevant to fun |
| Development difficulty | Medium | Medium-high: procedural platform levels are hard to make fair | High: 3D art, netcode, servers |
| Scope and major risks | One region solo in about 3–4 months. Risk: swap feels like a gimmick; three animation sets | Risk: fusion balance explodes combinatorially; feels less like Contra | Risk: large downloads hurt the PWA and 2G users; server costs; needs a team |

Scores are judgement calls from 1 (worst) to 5 (best), not data. "Development cost" scores 5 for the cheapest.

| Criterion | A. Hot Relay | B. Scrapfire | C. Skyline Siege |
| --- | --- | --- | --- |
| Originality | 3 | 4 | 3 |
| Player appeal to the target audience | 4 | 3 | 4 |
| Feasibility for solo browser development | 4 | 2 | 1 |
| Replayability | 3 | 5 | 4 |
| Commercial potential | 3 | 3 | 3 |
| Development cost | 4 | 3 | 1 |
| **Total (of 30)** | **21** | **20** | **16** |

A and B are close. A wins on feasibility and on being recognisably the game you described; B's replay strength is borrowed later as a daily remix mode built from hand-made chunks (section 7).

## 4. Recommended concept: Hot Relay

Build concept A. It keeps everything that defines a Contra-like (fast shooting, pickups, bosses, co-op), adds one mechanic most run-and-guns do not offer, and fits one developer and a browser download budget.

**How the Relay Swap works.** You field three operators but play one at a time. A single button tags in the next operator, who enters with a short invulnerable attack (a slide-shot, a ground-pound, a piercing round). Benched operators slowly recover armour. When the active operator falls, the next tags in automatically; the stage fails only when all three are down. Rescue pods in stages revive a fallen operator.

**Why it differentiates.** Broforce swaps your hero at random; Huntdown and Contra make you pick one character per run. Here the swap is a deliberate, timed decision: switch to the heavy for a boss phase, to the recon operator for a sniper nest, or to save a wounded operator. Whether no competitor does this is itself unverified (H2).

**The differentiation stack, in order of importance:**

1. Relay Swap as a skill and strategy layer, not a character-select screen.
2. Instant play from a link, then true offline play from the home screen.
3. Stages of 2–4 minutes, sized for a phone session or a portal visit.
4. An African-led cast opening in a West African coastal megacity, inside a global campaign where every region has local allies and the enemy is a transnational corporation, not a nationality.
5. A fair economy: money buys looks and content, never power.

**Assumptions still to test** (full register in section 10): players want this genre in a browser (H1); the swap is fun, not fiddly (H2); touch controls are good enough (H4); players will pay for the full campaign (H9); the game runs at 60 fps on mid-range Android within the download budget (H10).

## 5. Characters, weapons, enemies, bosses and missions

The roster starts at three operators and grows only when a new operator creates a decision the existing three do not. Sniper and reconnaissance are merged into one role, and there is no second "assault" character, because duplicates add animation cost without adding choices.

### Operator roster

| Operator | Role | Health / speed | Signature ability | Relay entry attack | Weakness | How play changes | Release |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kemi Adeyemi | Assault | Medium / fast | Dash-slide under fire, short i-frames | Slide-shot burst | Low armour | Aggressive pace, best for clearing waves | Vertical slice |
| Rurik Valdsson | Heavy | High / slow | Brace: plant a front shield while firing | Ground-pound stun | Slow jumps, overheats | Hold lanes, boss damage phases | Vertical slice |
| Mei-Lin Tsao | Recon / sniper | Low / medium | Mark: tagged weak points take extra damage from all operators | Piercing opening shot | Slow fire rate | Plan-ahead play, sniper nests, weak points | Vertical slice |
| Tomás Arriaga | Engineer | Medium / medium | Deploy a turret or barricade (one active) | Drops a turret on entry | Weak personal gun | Defensive play in survival and escort missions | Launch |
| Farida Haddad | Demolition | Medium / medium | Arc grenades; breach marked walls into hidden routes | Blast jump | Splash can't hit point-blank | Opens secret routes; area control | Post-launch region 2 |
| Sione Tupou | Support | Medium / medium | Faster armour regen for the bench; revive pods heal more | Shield pulse for allies | Low damage | Makes risky swaps safer; strong in co-op | Post-launch, only if co-op validated |
| KAI-7 | Experimental (elite) | Low / fast | Absorbs enemy bullets to charge a counter-blast | Phase-through entry | Loses armour constantly | Expert play built on reading bullet patterns | Unlock: finish campaign on Hard |

### Weapon catalogue

Three layers: an operator's sidearm (always available), Contra-style field pickups (temporary, lost when that operator falls), and one loadout weapon chosen before a stage. Values are starting design targets for tuning, not final numbers.

| Weapon | Layer | Damage profile | Fire rate | Range | Ammo | Special | How obtained |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kestrel SMG | Sidearm (Kemi) | Low per hit | High | Medium | Unlimited | Slight spread | Starter |
| Bulwark LMG | Sidearm (Rurik) | Medium | High | Long | Unlimited, overheats | Suppresses: slows enemies | Starter |
| Needle DMR | Sidearm (Mei-Lin) | High single | Low | Very long | Unlimited | Pierces one target | Starter |
| Fan | Pickup | Low × 5 shots | Medium | Medium | 40 bursts | 5-way spread | Field crate |
| Arc Lance | Pickup | Continuous | Beam | Medium | 8 s charge | Chains to 2 enemies | Field crate |
| Hornet | Pickup | Medium | Medium | Long | 30 missiles | Homing | Field crate |
| Furnace | Pickup | Damage over time | Stream | Short | 6 s fuel | Burns shields away | Field crate |
| Rail | Pickup | Very high | Very low | Screen-wide | 6 shots | Charge, pierces all | Field crate (rare) |
| Breacher shotgun | Loadout | High close | Low | Short | 8 shells | Knockback | Buy with Scrip |
| Tremor launcher | Loadout | High splash | Low | Arc | 6 grenades | Bounces once | Reward: region 1 boss |
| Volt carbine | Loadout | Medium | Medium | Medium | 30 rounds | Hold to overcharge | Reward: region 2 |
| Longshot rifle | Loadout | Very high | Very low | Very long | 5 rounds | Ignores armour | Mei-Lin mastery 5 |
| Harmattan | Legendary loadout | Medium burst | Medium | Medium | 24 rounds | Sand charge blinds enemies | Clear region 1 with no operator lost; never sold |

**Upgrades and attachments.** Each loadout weapon has 3 upgrade tiers bought with Scrip and parts earned in play. Attachments are sidegrades, never pure gains: a long barrel adds range but widens spread; a big magazine adds ammo but slows reload.

**Premium cosmetic variants.** Skins, tracer colours, muzzle flashes and finisher effects. Same hitboxes, same stats, same audio timing.

**Anti-pay-to-win safeguards:**

- Nothing that changes damage, health, speed or ammo can be bought with real money, directly or indirectly.
- Scrip cannot be bought. Time-savers (Scrip boosts) are not sold.
- Leaderboards and challenge ranks use fixed, normalised loadouts.
- Upgrade tiers are capped at 3, so a new player is at most a few hours behind on power.
- Trading: none at launch. Gifting cosmetics to friends can be added later; open trading only if section 8's conditions are met.

### Enemies and bosses (region 1 set)

| Enemy | Class | Behaviour | Teaches |
| --- | --- | --- | --- |
| Contractor rifleman | Grunt | Walks, fires 3-round bursts after a visible aim flash | Basic dodging |
| Riot contractor | Shield | Blocks front fire; vulnerable from above or behind | Jumping, positioning, Rurik's stun |
| Dock Crawler | Machine | Crab drone that scuttles along walls and ceilings | Shooting in 8 directions |
| Skitter swarm | Machine | Groups of 6 tiny drones that rush | Spread weapons, Fan pickup |
| Gantry sniper | Turret | Laser line, then a single heavy shot | Mei-Lin's Mark; reading telegraphs |
| Jetpack lancer | Air | Dives in an arc from off-screen | Upward fire, timing |
| **Miniboss: Harbour Mule** | Mech | Container-carrying walker; throws crates that become platforms | Using hazards as terrain |
| **Boss: The Dredger** | Ship-mech | Three phases: dredge arm sweeps, mortar barrage, exposed core during a rising tide | The full region's skills plus a timed Relay Swap window |

### Mission types

| Type | In the vertical slice | At launch | Later, if validated |
| --- | --- | --- | --- |
| Assault (reach the end) | Yes | Yes | — |
| Boss hunt | Yes | Yes | — |
| Timed extraction | No | Yes | — |
| Rescue (free hostages, optional objective) | As an optional objective | Yes | — |
| Sabotage (destroy marked targets) | No | Yes | — |
| Survival waves | No | No | Yes, with Tomás |
| Escort | No | No | Yes; escort missions are often disliked, so test first |
| Vehicle sections | No | No | Yes; high art and tuning cost |
| Infiltration / stealth | No | No | Probably never; it fights the genre's pace |

## 6. International campaign design

The campaign is eight fictional locations inspired by real geographies, in three acts. Every region has local allies with agency and expertise; the enemy everywhere is Nullward's machines and hired contractors, never a nation or ethnic group. City names are invented so no real place is misrepresented, and a cultural reader from each region reviews its writing and art before release.

**The story in three acts.** *Act 1 (regions 1–3):* the Lattice seizes a container port, a solar array and a steelworks; Relay Team learns it is harvesting energy and materials. *Act 2 (regions 4–6):* Nullward's CEO Calloway Strand is revealed as building a private orbital weapons platform from the stolen output; handler Dr Amara Bello's past at Nullward surfaces. *Act 3 (regions 7–8):* the rogue AI "Echo" turns on Strand; the team must stop both at the Lattice core.

| Region (fictional) | Inspired by | Mission arc | Hazard and distinctive mechanic | Unique enemies | Boss | Optional objectives and reward |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Port Ileya | Gulf of Guinea coastal megacity, mangroves | Harbour engineer Ifeoma Nwosu helps cut the hijacked port's power | Rising tide floods lower lanes on a timer; moving cranes are platforms | Dock Crawlers, riot contractors | The Dredger (ship-mech) | Rescue 6 dock crews; Tremor launcher |
| 2. Erg Saar Array | Saharan desert solar fields | Array chief Yasmin Belkacem shows the Lattice draining the grid | Sandstorms cut visibility; rotate mirrors to bounce enemy beams back | Heat-shimmer stalkers, beam drones | Heliarch (mirror tower) | Restore 3 relay stations; Volt carbine |
| 3. Kessler Works | Central European rail and steel city | A union foreman's crew sabotages the line from inside | Fight on moving freight trains; timed molten-steel pours | Track runners, armoured carriages | Railbreaker (armoured rail gun) | Save the signal box; Farida unlock path |
| 4. Saikō Tiers | East Asian vertical megacity | Transit AI technician Hana Seo reroutes maglev lines | Gravity-lift shafts carry you between levels | Maintenance drone swarms | Swarmwright (construction hive) | Find 5 data caches; Hornet mastery |
| 5. Karakhal Pass | South Asian high mountains | Mountain rescue ranger Arjun Thapa guides the team | Wind gusts push jumps and bullets; ropeways; avalanche chase | Cliff walkers, gust turrets | Talus (walker on a cliff face) | Rescue stranded climbers; armour skin |
| 6. Station Nordvakt | Arctic military installation | Glaciologist Ingrid Solberg tracks the stolen payload | Cold meter rises when you stand still; cracking ice | Snow-tread tanks, ice mines | Rimeback (snow-tank) | Thaw 4 generators; KAI-7 lore |
| 7. Rio Verde Canopy | South American rainforest research station | Botanist Luana Ferreira protects the station's seed bank | Three canopy layers; dark sections lit only by bioluminescence | Grafted harvester drones | Sapjaw (harvester) | Save the seed vault; Sione unlock path |
| 8. Ashfall Atoll | Remote Pacific island and underground core | Every ally contributes to the final assault | Remixes hazards from all regions | Echo constructs | Strand, then Lattice Prime | Perfect run medals; ending variant |

**Stage structure per region:** three stages of 2–4 minutes and a boss stage, about 12–15 minutes of first-time play. Rescue and collectible objectives add replay without padding the main path.

**Which mission types come first.** The vertical slice uses only assault and boss hunt (region 1). Launch adds timed extraction, rescue and sabotage because they reuse the same movement and combat. Survival, escort and vehicle sections wait until the core is validated, since each needs new systems or art.

## 7. Gameplay and progression systems

The loop is short on purpose: a player can open the game, finish one stage and leave with progress in under five minutes, which suits portal visits and phone sessions.

&#91;embedded content: core session loop · 6 steps, 2 return paths\]

The inner loop (pick, play, reward, upgrade) runs as long as the player wants; the outer loop brings them back through goals that respect their time.

**What makes the combat itself satisfying:** input-to-shot latency kept to one frame; coyote time and jump buffering so jumps feel fair; hit-stop and flash on every hit; enemies that announce attacks (aim flash, glow, sound) before they happen; deaths that are clearly the player's mistake; a checkpoint within 60 seconds of any death.

**Difficulty.** Four modes: Story (double armour, more checkpoints), Normal, Hard, and Iron Relay (no checkpoints, unlocked after the campaign). Boss phases repeat a pattern twice before mixing them. Accessibility toggles: screen shake, flashing, aim-assist, auto-fire, slower game speed for Story mode.

| Feature | Why players enjoy it | Risk of becoming a chore | Decision |
| --- | --- | --- | --- |
| Stage ranks and score attack | Mastery made visible | Low | Launch |
| Weapon and operator mastery | Goals tied to skill | Grindy if counts are high | Launch, with low counts |
| Secrets and hidden routes | Discovery, replay | Low | Launch |
| Achievements and medals | Clear goals | Low | Launch |
| In-game timer and splits | Speedrunners self-organise | None | Launch |
| Daily challenge | A fresh puzzle each day | Streak pressure | Launch, no streaks, yesterday's stays playable |
| Weekly remix ("Ops") | Hand-built chunks recombined with modifiers | Low | After launch, borrowed from concept B |
| Leaderboards (friends and global) | Competition | Cheating, discouragement | After launch, with friends boards first |
| Local co-op | Shared chaos | None | Launch |
| Seasonal events | Novelty | Fear of missing out | Later; event cosmetics return in later years |
| Login rewards, energy timers, streak penalties | — | Manipulative | Never |

**Keeping experts interested without overwhelming new players.** New players see three operators, one loadout slot and Normal mode; systems unlock one at a time over region 1. Experts get Hard and Iron Relay, mission modifiers (one operator only, no pickups, double-speed enemies), the KAI-7 elite operator, perfect-run medals and the weekly remix.

## 8. Blockchain feasibility and recommendation

Recommendation: no blockchain in version 1, and no token, NFT collection or play-to-earn economy at any stage. Revisit optional on-chain cosmetics only after launch, and only if H8 shows real demand and a Nigerian securities lawyer clears the design.

| Factor | A. Traditional, no blockchain | B. Optional on-chain cosmetics | C. Deeper Web3 economy |
| --- | --- | --- | --- |
| Player value | Proven: fun, fairness, cosmetics | Small: provable ownership and resale of a few cosmetics, for the minority who want it | Claimed: earning and trading; in practice draws speculators and bots |
| Development cost | Lowest | Wallet, minting, marketplace, admin: weeks to months | Highest: contracts, audits, token design, ongoing ops |
| Security exposure | Normal web security | Smart-contract and key-management risk | High: every contract bug can lose real money |
| Legal and tax | Consumer law, payments, data protection | Possibly securities and tax rules on resale | Very likely securities regulation |
| Platform access | Every store and portal | Steam bars blockchain apps; Apple restricts NFT features | Excluded from Steam; limited on iOS |
| Player reception | Neutral | Mixed; many gamers are hostile to NFTs | Often hostile |
| Survives shutdown | Saves are lost unless exported | Token survives; usefulness does not | Token survives; value usually collapses |

**The evidence that drives this.**

- **Platforms.** Steam's rules bar applications built on blockchain technology that issue or allow exchange of cryptocurrencies or NFTs ([Engadget](https://www.engadget.com/steam-ban-cryptocurrency-nft-trading-blockchain-valve-165038811.html)). That closes your best second platform. Apple allows selling NFTs through in-app purchase but forbids NFT ownership from unlocking features or functionality ([Apple](https://apple.co/3z61NuT)).
- **Market.** Many funded Web3 studios closed in 2025, mostly citing lack of funding. Proof of Play shut down despite a $33 million seed round ([KuCoin News](https://www.kucoin.com/news/flash/web3-game-studio-proof-of-play-shuts-down-after-33m-funding)); a ChainPlay report cited by Cointelegraph called 93% of Web3 game projects defunct ([Cointelegraph](https://cointelegraph.com/news/chronoforge-shut-down-collapse-web3-gaming-turmoil)). Some "forever" games shut anyway ([Decrypt](https://decrypt.co/350319)).
- **Nigerian law.** The Investments and Securities Act 2025 brings virtual and digital assets, including NFTs, under the definition of securities regulated by the SEC ([Mondaq](https://webiis10.mondaq.com/nigeria/fin-tech/1623238/what-the-investment-and-securities-act-2025-means-for-digital-and-virtual-assets-in-nigeria)). A tradable in-game asset with real-money value could put you in licensing territory; this needs a lawyer, not a guess.

**Owning a token is not owning the asset.** A token on a blockchain proves a wallet holds an entry in a ledger. The right to *use* that skin in the game comes from the game's terms of service and from the game's own code, which you control and can change. If the game shuts down or changes the rules, the token still exists, but the skin does nothing anywhere unless someone else chooses to support it. Interoperability between unrelated games is, today, mostly a promise: each game must build and maintain support for every other game's assets.

**If option B is ever built, these are the non-negotiable rules:**

- Cosmetics only; never weapons, operators, currency or stats.
- Off by default and fully optional; the game is identical without a wallet.
- Custodial or embedded wallet with email recovery, so a lost seed phrase cannot lose a purchase; export to self-custody available.
- A low-fee network chosen at that time; costs paid by the game, not the player, for minting.
- Server-side validation of every grant; the game never trusts a wallet or client to tell it what a player owns.
- A separate service that can fail without stopping play (section 11).
- Clear terms on what happens at shutdown; no promise of resale value, ever.
- Legal review in Nigeria and every major market, tax guidance on resale, privacy review of wallet data.

**Cheaper alternatives that give players the same feelings:** account-bound limited event cosmetics (scarcity without speculation), a public cosmetics showcase page (status), and gifting between friends (sharing).

## 9. Game economy and monetization

Use a hybrid model: free first region, a one-time paid campaign unlock, cosmetic packs and later paid regions, all priced in real money. There is one earned currency (Scrip), no premium currency, no loot boxes and no battle pass at launch.

### What players earn and what they buy

| Item | How it is earned | What it is spent on | Can money buy it? |
| --- | --- | --- | --- |
| Scrip (soft currency) | Stage clears, ranks, first-time objectives, daily challenge | Loadout weapons, upgrade tiers, attachments, some cosmetics | No |
| Parts | Optional objectives, boss clears | Upgrade tiers 2 and 3 | No |
| Weapon unlocks | Region bosses, mastery, legendary feats | — | No |
| Operator unlocks | Campaign progress and challenges | — | No (paid campaign unlocks the stages that award them) |
| Cosmetics | Some via medals and events | Skins, tracers, finishers | Yes, direct price |
| Full campaign | — | Regions 2–4 at launch | Yes, one-time |
| Expansion regions | — | Regions 5–8, released over time | Yes, one-time each or bundle |
| Seasonal track | Deferred; only if players ask for more goals after launch | Cosmetic-only rewards | Possibly, never with power |

**How Scrip enters and leaves.** Sources: first-time stage clears pay the most; replays pay a reduced, rank-based amount; the daily challenge pays a fixed bonus once per day. Sinks: weapon purchases, upgrade tiers (rising cost per tier), attachment swaps (small fee), and cosmetic Scrip items that rotate. Because there is no trading and no purchasable Scrip, inflation can only hurt pacing, not fairness; watch "Scrip held per player" and add sinks if it climbs.

**Offline earnings.** Stages played offline award Scrip into a local ledger. On reconnect the server replays the claimed results against plausibility rules (stage time, score range, daily caps) and accepts them. Leaderboard runs and purchases always need a connection.

**Guards against grind and exploits:** first-clear rewards cover a full upgrade path in normal play; replay rewards decay within a day to stop farming loops; server-side caps per stage per day; no Scrip boosters for sale; signed run summaries and input-replay checks for anything ranked.

### Business model comparison

| Model | Strengths | Weaknesses | Fit for browser + Nigeria |
| --- | --- | --- | --- |
| Premium only | Simple, fair, no ad clutter | Browser players rarely pay upfront for unknown games | Poor as the only model |
| Free-to-play | Biggest reach; portal-friendly | Pressure toward power sales and energy timers; needs huge volume | Risky; pulls design toward chores |
| Hybrid: free region + paid unlock + cosmetics (recommended) | Players try before buying; ads only in the free region; fair | Two systems to build; conversion unknown | Good: matches portal traffic and lets local-price checkout work |

**Payments.** On your own site use local rails for Nigeria (Paystack or similar for cards, bank transfer and USSD) and a global provider for everyone else. Many Naira cards are reported to fail on international payments ([Apple Developer Forums](https://developer.apple.com/forums/thread/787448)); Xsolla added Paga's mobile money in Nigeria in December 2025 ([Business Wire](https://secure.businesswire.com/news/home/20251204075908/en/Xsolla-Expands-Local-Payment-Options-in-Nigeria-Through-Full-Paga-Ecosystem-Integration-Serving-More-Than-20-Million-Users)). CrazyGames supports in-game purchases through Xsolla for invited games ([CrazyGames guide](https://app.cinevva.com/guides/publish-game-crazygames)), so check each portal's rules before linking to your own checkout.

### A simple financial model (illustrative, not a forecast)

```latex
\text{Monthly sales revenue} = \text{own-site players} \times \text{share reaching end of region 1} \times \text{purchase rate} \times \text{net price}
```

Assumptions shown in each row are placeholders until Gates 4–7 measure them. Net price assumes a $4.99 unlock less about 10% payment fees (verify with your provider). Portal ad revenue and cosmetics are excluded because no credible figures exist yet for this game.

| Scenario | Own-site players / month | Reach end of region 1 | Buy the campaign | Net price | Monthly sales |
| --- | --- | --- | --- | --- | --- |
| Low | 5,000 | 30% | 2% | $4.49 | about $135 |
| Middle | 20,000 | 40% | 3% | $4.49 | about $1,080 |
| High | 100,000 | 50% | 4% | $4.49 | about $8,980 |

The model's lesson is that traffic you bring yourself matters most: Poki also pays 100% of ad revenue on it versus 50% on its own traffic. Set Naira prices locally rather than converting the dollar price.

## 10. Hypothesis register and validation experiments

Twelve assumptions decide whether this game is worth building; H1, H2, H4 and H10 are tested in the first six weeks because each can kill the project cheaply. Every threshold below is a provisional internal target unless a source is named, and should be adjusted once you see real test conditions.

| ID | Assumption and why it matters | Evidence now / still unknown | Cheapest test and sample | Metric · pass · fail | Time · cost | If pass → / If fail → |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Web players want a modern Contra-like. Without demand nothing else matters | Genre sells on PC/console (section 2). Unknown: browser appetite for precise action | One polished stage on itch.io + CrazyGames' no-SDK Basic Launch; 300+ players | Share playing ≥3 min. A guide reports Poki's first test bar as 25% of 500 players ([Cinevva](https://app.cinevva.com/id/guides/publish-game-poki)). Pass ≥25%; fail <15% | 2 weeks · $0–100 | Build the vertical slice / Rework onboarding once, then reconsider format |
| H2 | The Relay Swap is fun, not fiddly. It is the main differentiator | None for this exact mechanic | Two builds of one stage: swap vs one operator; 15 target players in person or on call | Unprompted swaps per minute and stated preference. Pass ≥60% prefer swap and ≥2 swaps/min; fail <40% | 2 weeks · $0–150 (data/airtime gifts) | Keep as core / Test Weapon Fusion (concept B) as the hook instead |
| H3 | 2D pixel art beats 2.5D for this audience and budget | 2.5D costs more and downloads larger | Three 10-second clips (pixel, painted 2D, 2.5D) shown to 30 players; cost quotes from 2 artists | Preference + cost per character. Pass: pixel within 15 points of the favourite | 1 week · $0 | Pixel art / Choose the favourite only if the budget allows |
| H4 | Touch controls can be good enough for mobile web | Many mobile shooters lose players on controls (assumption) | Same stage with keyboard/gamepad vs touch; 20 players split | Stage completion rate. Pass: touch within 25% of keyboard; fail: gap >50% | 1 week · $0 | Mobile-equal launch / Launch desktop-first; add aim-assist and auto-fire for touch |
| H5 | Players enjoy weapon progression, not grind | Unknown for this audience | Alpha with Scrip shop; 50+ players | Share spending Scrip in first 3 sessions; "grind" mentions in feedback. Pass ≥60% spend, <10% complain | 3 weeks · $0 | Keep / Cut tiers, raise first-clear payouts |
| H6 | International regions raise engagement | Plausible, unproven | Alpha end screen teasing region 2 with a "notify me" button | Click-through and D7 return of clickers vs others. Pass ≥20% click | 2 weeks · $0 | Fund region 2 art / Deepen region 1 replay first |
| H7 | Co-op is essential | Contra, Broforce and Huntdown all ship co-op | Local co-op toggle in alpha | Share of sessions in co-op. Pass ≥15%; fail <5% | 3 weeks · $0 | Plan online co-op later / Keep co-op local only |
| H8 | On-chain ownership adds player value | Market and platform evidence negative (section 8) | Post-launch fake door: "keep this cosmetic as a collectible" option at checkout; survey | Share of buyers choosing it; sentiment. Pass ≥20% and no rise in negative reviews | 2 weeks · $0 | Legal review, then design option B / Drop blockchain |
| H9 | Players will pay for the full campaign | Premium run-and-guns sell on PC/console | Region 1 end screen with a real price and pre-order or "notify me"; later live checkout | Share of region-1 finishers who click buy. Pass ≥2%; fail <0.5% | 3 weeks · $0–50 | Hybrid model as planned / Test lower price or ads-plus-cosmetics |
| H10 | Feasible: 60 fps on mid-range Android, small download, offline launch | Phaser 4's new renderer targets performance ([GitHub](https://github.com/phaserjs/phaser/discussions/7274)) | Stress scene with 60 enemies and 200 bullets on 3 devices (low, mid, desktop) | Median fps ≥55, 10th percentile ≥45; first load ≤8 MB; offline start works | 1 week · $0 | Continue / Cut effects, lower resolution, or reconsider engine |
| H11 | Offline play matters to players | Data is cheap but 2G is 36% of connections | Instrument session start state in alpha and beta | Share of sessions started offline. Pass ≥10%; fail <3% | Runs during alpha · $0 | Invest in offline-first content / Keep offline as a convenience |
| H12 | Portal ad revenue covers running costs | Poki/CrazyGames share ad revenue; amounts unpublished for this genre | Portal test launch of region 1 | Revenue per 1,000 plays, measured | 4 weeks · $0 | Lean on portals / Push own-site traffic and the paid unlock |

**What does not count as evidence:** likes, wishlists of a concept image, survey enthusiasm, friends' praise, or AI-generated opinions (including this document). Only behaviour does: minutes played, replays, clicks on a real price, and money paid.

## 11. Technical architecture and engine recommendation

Use Phaser 4 with TypeScript as a PWA, and a small FastAPI + PostgreSQL service for anything that must be trusted. This reuses your existing stack, keeps the first download small, and lets Claude Code work in a language and framework you already know. Phaser 4.0 shipped in April 2026 with a rebuilt WebGL renderer ([GitHub](https://github.com/phaserjs/phaser/discussions/7274), [Phaser downloads](https://phaser.io/download/phaser4)).

&#91;embedded content: target architecture · 3 zones, offline-first client\]

The client plays everything offline; the sync queue sends results to the server when a connection returns, and only the server grants rewards, validates ranked runs and unlocks paid content.

### Engine comparison

| Engine | Fit for a 2D browser PWA | Strengths | Weaknesses for this project |
| --- | --- | --- | --- |
| Phaser 4 (recommended) | Native web; built for it | JavaScript/TypeScript you know; small runtime; open source; widely used on portals | You build tools (level loading, UI) yourself; 2D only |
| Godot 4 | Good, via web export | Free, excellent 2D editor and animation tools | New language (GDScript) and engine to learn; engine runtime adds to first-load size; test mobile-browser export early |
| Unity | Workable via WebGL | Huge asset store, mature tooling | Larger web builds; licence terms to track; slower iteration for a solo web project |
| Unreal Engine | Poor | Top-end 3D | Not suited to small browser games |

### Recommended stack

| Area | Choice | Why |
| --- | --- | --- |
| Engine and language | Phaser 4 + TypeScript, built with Vite | Small, fast, your language |
| Level design | Tiled map editor, JSON export | Free, Phaser loads it directly |
| Art and animation | Aseprite pixel art, sprite atlases (TexturePacker or free packer) | Small files, crisp scaling |
| Audio | Short OGG/MP3 SFX, compressed music streamed after first load | Keeps first download small |
| PWA | Web app manifest + Workbox service worker (e.g. vite-plugin-pwa) | Install, offline cache, update prompts |
| Local save | IndexedDB (small wrapper library) | Survives offline; larger than localStorage |
| Version control | Git + GitHub; Git LFS for source art | Standard; art history |
| Backend | FastAPI on Railway, PostgreSQL | Your stack; cheap at this scale |
| Accounts | Email magic link or social login; guest play with later account linking | No friction for first play |
| Analytics | Event pipeline to your own Postgres table first; a hosted tool later | Own your data; free |
| Crash reporting | Sentry or similar free tier | Browser errors by device |
| Testing | Unit tests for game logic; Playwright smoke tests that load and play a stage headlessly | Catch broken builds before portal release |
| Anti-cheat | Server-side ledger; deterministic input replays for ranked runs | Client is never trusted |
| Payments | Local rails for Nigeria plus a global provider; webhooks unlock content | Card failures are common for Naira cards |
| Multiplayer | Local co-op only; online co-op deferred (WebRTC or a relay server if validated) | Avoids netcode before the core is proven |
| Optional blockchain | Separate service behind the ledger, only if section 8's conditions are met | Game works if it is down |

### Trust boundaries

- **Runs locally:** all gameplay, physics, enemy AI, rendering, audio, local saves, offline progression, local co-op.
- **Needs the backend:** cloud save, cross-device progress, leaderboards, daily challenge seeds, purchases, event content.
- **Never trust the client for:** currency balances, unlocks bought with money, leaderboard scores, purchase status, anything tradable. The client *requests*; the server *decides*.

**iOS caveats.** All iOS browsers use Apple's WebKit engine. There is no automatic install prompt, so the game needs a short "Add to Home Screen" guide. WebKit says home-screen web apps keep their own days-of-use counter, separate from Safari's 7-day storage rule ([WebKit Bugzilla](https://bugs.webkit.org/show_bug.cgi?id=237350)). Cloud save is still the safety net.

**Build order.** No backend at all until Gate 4 passes: the prototype is a static PWA. Add cloud save in the vertical slice, the ledger and store in alpha, leaderboards in beta.

## 12. Minimum viable game and vertical slice

The vertical slice is region 1 only: Port Ileya, three operators, one complete 3-stage mission and the Dredger boss, playable online and offline. It must prove the game is fun, swappable, playable on a phone and fast to load before any second region, operator or system is built.

**In scope:**

- Operators: Kemi, Rurik, Mei-Lin with Relay Swap, entry attacks and bench armour regen.
- Environment: Port Ileya, 3 stages of 2–4 minutes plus the boss stage.
- Enemies: 5 types (rifleman, riot contractor, Dock Crawler, skitter swarm, gantry sniper), the Harbour Mule miniboss, the Dredger boss.
- Weapons: 3 sidearms, 3 pickups (Fan, Arc Lance, Hornet), 1 loadout weapon (Breacher).
- Systems: movement, 8-way shooting, health and armour, checkpoints, stage ranks, Scrip and one upgrade tier.
- Controls: keyboard, gamepad (browser Gamepad API) and touch with optional aim-assist.
- PWA: installable, offline after first load, local save in IndexedDB, simple cloud save when online.
- Feel: hit-stop, screen shake (toggleable), muzzle flash, impact sparks, placeholder-quality but punchy sound.
- Instrumentation: the prototype metrics in section 16, plus a 3-question post-stage survey.

**Out of scope until validated:** other regions, operators 4–7, online co-op, accounts beyond a simple save sync, store and payments, leaderboards, cosmetics, blockchain, story cutscenes beyond text panels, localisation.

**What the slice must prove before more investment:**

1. New players reach the first enjoyable fight in under 30 seconds from opening the link.
2. At least 25% of portal players play 3 minutes or more (H1).
3. Testers swap operators on purpose and prefer the swap build (H2).
4. Touch players complete stage 1 at a rate within 25% of keyboard players (H4).
5. It runs at 55+ median fps on a mid-range Android phone, loads under 8 MB, and starts offline (H10).
6. A meaningful share of players replay a stage voluntarily for a better rank.

If points 1–3 fail after one round of fixes, stop or pivot before spending on art.

## 13. Phased development roadmap

Nine gates take the lean plan from research to launch in about 48 weeks, with the critical go/no-go decision at week 6, before any significant art spending.

&#91;embedded content: lean solo plan · 9 gates, durations from section 14 estimates\]

Weeks are planning estimates for one developer working close to full time; part-time work stretches every bar.

| Gate | Objective | Deliverables and experiments | Acceptance criteria | Cash cost | Continue / pivot / stop |
| --- | --- | --- | --- | --- | --- |
| 1 · Market research | Know what wins and why | This document; reference play notes | Top 3 risks named; concept chosen | $0 | Continue unless research shows no audience |
| 2 · Concept tests | Check the pitch lands | 15–20 interviews; one-page pitch; art-style clips (H3) | Testers can repeat the hook back; style chosen | $0–100 | Pivot concept if nobody cares about the hook |
| 3 · Core prototype | Prove feel and feasibility | Greybox stage, Relay Swap, touch, PWA offline (H10) | 60 fps on mid Android; offline start; feels good to you on gamepad | $0–200 | Stop or switch engine if performance fails twice |
| 4 · Playtesting | Prove fun with strangers | H1, H2, H4 tests; itch.io and CrazyGames Basic Launch | ≥25% play 3+ min; swap preferred; touch gap <25% | $0–300 | **Go/no-go.** Pivot hook (Weapon Fusion) or stop if H1 and H2 both fail |
| 5 · Vertical slice | One region at release quality | Port Ileya, 3 operators, Dredger boss, final art and sound, cloud save | Beats prototype metrics; testers ask for more | $500–2,500 | Continue if completion and replays hold; else fix before scaling |
| 6 · Closed alpha | Content and systems at scale | Regions 2–3 in progress, Scrip economy, local co-op, analytics | D1/D7 stable or rising across two builds; crash-free ≥99% | $3,000–12,000 | Cut regions if pace is too slow; never add unvalidated systems |
| 7 · Beta and economy | Prove people pay | Region 4, store, pricing test (H9), Engineer operator | ≥2% of region-1 finishers buy | $4,000–15,000 | Re-price or change model if <0.5% |
| 8 · Launch readiness | Ship cleanly | Portal SDKs, trailer, store pages, legal terms, privacy policy, payment QA | No blocker bugs; payments tested with real cards and transfers | $2,000–10,000 | Delay launch rather than ship broken payments |
| 9 · Live operations | Grow and sustain | Updates, daily challenge, weekly remix, region 5 if justified | Revenue ≥ running costs within 3 months | From revenue | Fund new regions only from evidence of completion and purchase |

**Scope-control rule.** A feature enters the build only if it (1) serves a hypothesis currently being tested, or (2) has passed its test, or (3) is required to ship. Everything else goes on the "not now" list. Each new idea gets a one-line hypothesis and the cheapest test before it gets code.

The task-by-task build plan with dates and hour estimates is in Build plan.

## 14. Budget scenarios and team requirements

The lean solo route gets a validated vertical slice for roughly $500–3,000 cash and a four-region launch for roughly $15,000–50,000; your own time is the main cost. All figures are rough planning estimates in USD, not quotes; contractor rates vary widely by country and experience, so get two quotes per asset type before committing.

| Scenario | Team | Time to vertical slice | Time to launch | Cash cost to slice | Cash cost to launch | What launch contains |
| --- | --- | --- | --- | --- | --- | --- |
| Lean solo (recommended start) | You + contract pixel artist, animator, composer/SFX | 10–14 weeks | 9–15 months | $500–3,000 | $15,000–50,000 | Regions 1–4, 4 operators, local co-op, own-site store, portals |
| Small independent studio | 4–8 people: 2 devs, 2 artists, designer, audio, part-time producer and QA | 8–10 weeks | 18–24 months | $40,000–120,000 | $300,000–1,000,000 | All 8 regions, 7 operators, online co-op, Steam and console ports |
| Larger commercial production | 20–50 people incl. dedicated netcode, live-ops, UA | 3–6 months | 2–3 years | $500,000+ | $3,000,000–15,000,000 | Multi-platform, live service, seasons, paid marketing |

**Where the lean money goes (launch estimate):** pixel art and animation 50–60%, music and sound 10–15%, playtesting incentives and cultural readers 5–10%, marketing assets (trailer, capsule art) 10%, legal and company admin 5–10%, infrastructure under 5%.

**Running costs, lean route (approximate, check current prices):** Phaser is free and open source; an art tool such as Aseprite is a one-time purchase of about $20; static hosting for the PWA can be free; a small FastAPI + PostgreSQL service on Railway costs from a few dollars to tens of dollars a month at this scale; a domain is about $15 a year; error tracking and analytics have free tiers.

**Affordable now:** one region, three operators, offline PWA, portal launch, local co-op, simple cloud save.

**Needs a larger team or revenue first:** online real-time co-op, vehicle sections, regions 5–8, console ports, full voice acting, paid user acquisition.

**Defer until evidence says otherwise:** blockchain, seasonal pass, PvP, user-generated cosmetics, interoperability.

## 15. Risks, failure modes and mitigation

The two risks most likely to end this project are scope creep and touch controls; both are addressed by testing early and refusing unvalidated features.

| Risk | Likelihood | Impact | Early warning sign | Mitigation |
| --- | --- | --- | --- | --- |
| Scope creep: building regions, operators or systems before validation | High | High | Work on region 2 starts before Gate 4 passes | Scope rule in section 13; a written "not now" list reviewed weekly |
| Touch controls feel bad | High | High | Touch completion far below keyboard | Test in week 2; aim-assist, auto-fire option, contextual jump; desktop-first fallback |
| Relay Swap is a gimmick | Medium | High | Testers ignore it unless forced | H2 A/B test; fall back to Weapon Fusion hook |
| Browser performance on low-end Android | Medium | High | fps drops with many bullets | Object pooling, sprite atlases, low-effects mode, 480×270 base resolution |
| iOS PWA limits (no install prompt, storage rules, quotas) | High | Medium | iOS players lose saves or never install | Cloud save; clear "Add to Home Screen" guide; WebKit says home-screen apps keep their own data timer ([WebKit Bugzilla](https://bugs.webkit.org/show_bug.cgi?id=237350)) |
| Discoverability: nobody finds it | High | High | Low portal traffic, no own-site growth | Portals as launch pads; devlog clips on TikTok/X/YouTube Shorts from week 1; local gaming communities |
| Players will not pay | Medium | High | <0.5% click buy | H9 early; adjust price, regional pricing, ads-plus-cosmetics |
| Art cost overruns | Medium | Medium | Animation quotes exceed plan | Lock sprite size, frame counts and palette early; reuse rigs |
| Cheating on leaderboards | Medium | Medium | Impossible scores | Server-side replay validation; fixed loadouts; shadow-ban queue |
| Cultural misrepresentation | Medium | High | Feedback from players in a region | Paid cultural readers per region; invented city names; local allies with agency |
| Burnout as a solo developer | Medium | High | Missed weekly goals 3 weeks running | 2-week milestones, hard "done" definitions, a co-founder or contractor for art |
| IP closeness to Contra | Low-medium | High | Reviewers call it a clone | No borrowed names, sprites, music, weapon letters or level layouts; original universe |
| Payment failures in Nigeria | Medium | Medium | Checkout abandon rate high | Local rails (cards, transfer, USSD, wallets); test with real Naira cards |

## 16. Success metrics and go/no-go criteria

Each stage watches a few metrics that answer that stage's question; everything else is noise until later. All targets are provisional internal targets except the 3-minute play bar, which a publishing guide attributes to Poki's first test.

| Stage | Metric that matters most | Supporting metrics | Provisional target | Go / no-go |
| --- | --- | --- | --- | --- |
| Prototype (Gates 3–4) | Share of players playing ≥3 minutes | Time to first fight; deaths per section; voluntary replays; swaps per minute | ≥25% play 3+ min; first fight <30 s | Go if ≥25% and H2 passes; no-go if <15% after one fix round |
| Vertical slice (Gate 5) | Mission completion rate | Boss attempts to clear; touch vs keyboard gap; fps p50/p10; load size | 40–60% complete the mission; touch gap <25% | Go to alpha if the slice beats prototype numbers and passes H10 |
| Closed alpha (Gate 6) | Day-1 and day-7 return | Session length; Scrip spend; crash rate; offline session share | Set from slice data; crash-free sessions ≥99% | Go if returns hold or improve across two builds |
| Beta (Gate 7) | Purchase rate among region-1 finishers | Checkout abandon; refunds; payment failure rate by method | ≥2% of finishers buy | Go to launch if paying players also rate it well |
| Launch and live (Gates 8–9) | Monthly revenue vs running costs | Portal revenue per 1,000 plays; review score; D7; region completion | Revenue ≥ costs within 3 months | Fund region 5 only if launch regions are completed by a healthy share |

**Reading small samples honestly.** With 15 testers, 9 preferring the swap build (60%) has a 95% confidence range of roughly 36% to 80%. That is a direction, not proof. Treat small tests as filters that catch clear failures; combine numbers with what you saw testers do and say, and repeat a test before making an expensive, irreversible decision.

**Benchmarks.** No credible universal retention or conversion benchmark exists for a browser run-and-gun, so the targets above should be replaced by your own baseline after the first portal test. Compare each build to the previous build, not to other genres.

## 17. First ten actions, open questions and first-week plan

Start by proving the game feels good in a browser on a phone; nothing else in this document is worth money until that is true.

The full tick-off checklist for every gate is in Task list by gate.

**The first ten actions:**

1. Play Contra: Operation Galuga, Broforce, Huntdown and a mobile Metal Slug for 2 hours each; write down 10 moments of great feel and 10 frustrations.
2. Set up the repo: Phaser 4 + TypeScript + Vite, the PWA plugin, and one test scene.
3. Build the movement-and-shooting greybox: run, jump, 8-way aim, one enemy, hit-stop. Tune until it feels good with a gamepad.
4. Add the Relay Swap with three placeholder operators (coloured rectangles are fine).
5. Add touch controls and test on a mid-range Android phone; record fps.
6. Make it installable and playable offline; confirm it launches in airplane mode.
7. Write the one-page "not now" list and the scope rule from section 13; pin it.
8. Recruit 15–20 testers: friends who play action games, two Nigerian gaming communities, one online run-and-gun community.
9. Run the H2 swap test and the H4 touch test; record sessions with permission.
10. Ship the stage to itch.io and apply to CrazyGames' Basic Launch for the H1 test.

**Most important unanswered questions** (your answers change the plan):

- How many hours a week can you give this alongside your other products?
- What cash budget can you commit to the first 12 weeks?
- Do you want the home-market (Nigeria/West Africa) angle front and centre, or a globally neutral first impression?
- Is your blockchain interest driven by a specific partner, grant or community? If so, who, because that changes the risk picture.

**First-week plan:**

- [ ] Day 1: play the four reference games; write the feel notes.
- [ ] Day 1: create the repo with Phaser 4, TypeScript, Vite and the PWA plugin.
- [ ] Day 2: player movement with coyote time and jump buffering; 8-way aiming.
- [ ] Day 3: bullets with object pooling; one rifleman enemy with a visible aim telegraph; hit-stop and screen shake.
- [ ] Day 4: Relay Swap with three placeholder operators, entry attacks and bench armour regen.
- [ ] Day 5: touch controls; test on your phone; log fps with 60 enemies and 200 bullets on screen.
- [ ] Day 6: service worker and manifest; verify offline launch and local save in IndexedDB.
- [ ] Day 7: recruit testers, book 5 sessions for next week, write the 3-question survey.

### Sources

- [Dead Cells 10 million press release (GamesPress)](https://gamespress.com/Dead-Cells-Has-Sold-More-Than-10-Million-Copies)
- [Dead Cells mobile 5 million (80 Level)](https://cdn.80.lv/articles/dead-cells-mobile-sales-surpass-5-million-copies/)
- [Cuphead 5 million in two years](https://cur.at/gH2VlnV?m=web)
- [Broforce 7 million (GoNintendo)](https://gonintendo.com/contents/23872-sales-milestones-shared-for-broforce-fuga-melodies-of-steel-and-pinball-fx)
- [Free Lives and Broforce estimates (Daily Investor)](https://dailyinvestor.com/technology/146088/the-south-african-game-studio-that-made-r172-million-with-its-first-game/)
- [Contra: Operation Galuga co-op review (Co-Optimus)](https://www.co-optimus.com/review/2492/page/1/contra-operation-galuga-co-op-review.html)
- [Contra: Operation Galuga Steam estimates (SteamPulse)](https://www.steampulse.org/game/2235020) and [(Raijin)](https://raijin.gg/app/2235020/Contra_Operation_Galuga)
- [Contra: Operation Galuga review (TouchArcade)](https://toucharcade.com/?p=320603)
- [Metal Slug Attack and Defense end of service (Boss Rush)](https://bossrush.net/2022/11/07/free-to-play-games-metal-slug-attack-and-defense-to-end-service-early-2023/)
- [Metal Slug: Awakening launch (iPhoneSoft)](https://iphonesoft.fr/2024/07/19/legendaire-metal-slug-retour-awakening)
- [Huntdown details (Deku Deals)](https://www.dekudeals.com/items/huntdown) and [owner estimate (SteamSpy)](https://www.steamspy.com/dev/Easy+Trigger+Games)
- [Poki for Developers](https://sdk.poki.com/)
- [Poki COO on browser gaming (PocketGamer.biz)](https://www.pocketgamer.biz/inside-pokis-vision-for-the-future-of-browser-gaming/)
- [Poki interview on 2025 and revenue (Mobidictum)](https://mobidictum.com/?p=209499)
- [Publishing on Poki guide (Cinevva)](https://app.cinevva.com/id/guides/publish-game-poki)
- [CrazyGames developer guide (Cinevva)](https://app.cinevva.com/guides/publish-game-crazygames)
- [Phaser v4.0.0 release (GitHub)](https://github.com/phaserjs/phaser/discussions/7274)
- [WebKit: home-screen web app storage (Bugzilla)](https://bugs.webkit.org/show_bug.cgi?id=237350)
- [Steam bans blockchain games (Engadget)](https://www.engadget.com/steam-ban-cryptocurrency-nft-trading-blockchain-valve-165038811.html)
- [App Store guideline update on NFTs (Apple)](https://apple.co/3z61NuT)
- [Proof of Play shutdown (KuCoin News)](https://www.kucoin.com/news/flash/web3-game-studio-proof-of-play-shuts-down-after-33m-funding)
- [ChronoForge shutdown and Web3 gaming (Cointelegraph)](https://cointelegraph.com/news/chronoforge-shut-down-collapse-web3-gaming-turmoil)
- [Crypto games shut down in 2025 (Decrypt)](https://decrypt.co/350319)
- [ISA 2025 and digital assets in Nigeria (Mondaq)](https://webiis10.mondaq.com/nigeria/fin-tech/1623238/what-the-investment-and-securities-act-2025-means-for-digital-and-virtual-assets-in-nigeria)
- [Naira cards and in-app purchase (Apple Developer Forums)](https://developer.apple.com/forums/thread/787448)
- [Xsolla adds Paga in Nigeria (Business Wire)](https://secure.businesswire.com/news/home/20251204075908/en/Xsolla-Expands-Local-Payment-Options-in-Nigeria-Through-Full-Paga-Ecosystem-Integration-Serving-More-Than-20-Million-Users)
- [Nigeria data prices and network mix (Intelpoint)](https://intelpoint.co/insights/1gb-of-data-in-the-us-costs-15-times-more-than-in-nigeria/)
- [Nigeria data spending 2025 (TechCabal)](https://techcabal.com/2026/02/09/how-nigerians-spent-%E2%82%A620-87billion-daily-on-data-in-2025/)
