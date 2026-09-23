# +1 Spider Evolution

Browser multiplayer Spider-Man "+1" game: Three.js client, Colyseus server, npm workspaces
(`shared` / `server` / `client`). Infrastructure (Bloxity auth, persistence, Bux grants, deploy) follows the
Evolution series (`D:\+1 Superhero Evoluion`, `D:\+1 Katana Evolution`); gameplay, world and UI are this game's own.

## Commands

```bash
npm run dev                 # builds shared, then server (tsx watch, :2589) + Vite client (:5189)
npm run build               # shared + server + client (client/dist)
npm run typecheck           # all workspaces
npm run verify              # verify:progression + verify:assets
npm run verify:capacity     # needs a running server on :2589; 18 clients, expects 15-per-room routing
npm run verify:multiplayer  # needs a running server; runs, webs, swings, forgeries, refusals
npm run verify:run          # needs a running server; train, Stage 1 fight, clear, claim, death, reset
npm run verify:persistence  # identity/storage/migration/purchases, JSON and Mongo (if mongod is found)
npm run size:client         # client/dist size against the 12 MB budget
```

Do NOT use python from the Bash tool on this machine. Use node/sed/perl. Never commit or push: the user handles git.
Beware shell escaping when patching files that contain backticks: prefer the Write/Edit tools.

## Non-negotiable rules

- Ports: server **2589**, Vite **5189**, preview 4189. Room `spiderevolution`, Bloxity slug `spider-evolution`
  (`shared/src/config/accounts.ts` AND `client/src/bloxity/Bloxity.ts`), 15 per room.
- **Client build under 12 MB** (currently ~4.5 MB, 3.2 MB of it the Spider-Man music). Suits are PAINTED at runtime
  onto the supplied player model (`client/src/suits/SuitPainter.ts` + `SpiderSuits.ts`, optional glow maps); gear,
  shooters, pets, villains and props are primitives (`PartBuilder`). Only `assets/` ships as files;
  `Background.mp3`, `shop.png` and `base_rig.fbx` are pruned by `client/vite.config.ts`. `verify-assets` pins digests.
- **Everything is server-authoritative.** Clients send input and requests; the server simulates, validates, pays.
  `ProgressionService` is the ONLY granter of Web Power / XP and `syncDerived` the ONLY writer of level, gain,
  multiplier, speed, swings, max health and defense.
- **Progression** (`shared/src/config/progression.ts`): a web click pays `suit x shooter x pets x gear power x
  rebirth (x training building)` to BOTH Web Power and XP. Running pays XP only (`RUN_STRIDE`, from grounded
  distance the SERVER simulated). Level = band of XP (116 x 2.5^(L-1) per level: L6 needs 11.3K). **LEVELS ARE
  UNCAPPED**: no MAX_LEVEL, no level table (cumulative totals are cached lazily); stats saturate at `MAX_STAT` (near the
  float64 limit, ~Level 770), never Infinity. Speed = 16 + 1/level to 24, then + 8 ln(L/24), x gear speed. Swings = 2 + 1
  per 3 rebirths (max 6, a design cap). Damage to an enemy = the whole Web Power.
- **Rebirth** (`rebirth.ts`) is **UNCAPPED and formula-only** (never a table): XP x(1+R); HP 100+50R; next needs Level 8
  (R0), 12 (R1), then 12 + floor(3 log2(1 + (R-2)/6)) - logarithmic so the next rebirth always stays reachable.
  `rebirths` is float64 on the wire and in saves (no 16-bit clamp). Print counts with `formatCount`, figures with
  `formatAmount` (K, M, B, T, Qa, Qi, Sx ... to 1e303). Resets Web Power, XP, Wins and suits; keeps pets, gear,
  shooters, stage record. Taken in the plaza only.
- **Exactly 30 stages** (`stages.ts` PLANS): each its own theme (StageWorld THEMES + StageDressing DRESSINGS with a
  landmark) and henchman/boss looks (EnemyLooks). Power x5 and Wins x4.5 a stage past 18; `verify-progression` pins it.
- **The web swing is part of the shared sim** (`shared/src/sim/PlayerSim.ts`, `SWING` in `movement.ts`): a mid-air jump
  press with a swing left hangs the player from an anchor ahead/above as a pendulum; landing refills. Every swing field
  is in `PlayerMotion`, replicated and reconciled. A head ceiling applies (plaza 36, street below the gate walls), and
  gates are solid to the wall top, so no swing vaults a locked stage.
- **Webs**: reach 16 grounded, 26 airborne (+slack) and 24 vertically - that is the auto-click swing LOCK-ON
  (`TargetSelector.aim(lockOn)`). A named target the player may not hit still yields a notice ('locked-building',
  'sealed') even when the web lands elsewhere.
- **Enemies are a fixed per-player pool** (`EnemyState.enemyStates()`, all 138, indexed by id) in `PlayerState.enemies`,
  replicated normally (only changes travel; each client draws its own player's pool). Runs reset the pool IN PLACE
  (`CombatService.startRunAt`); never push or splice it. Do NOT make it a `@view` field: a StateView-filtered array was
  seen to lose entries when two players joined together (`verify:multiplayer` now checks concurrent joins).
- **Gear** (`gear.ts`, `GearService`): enemy drops (boss always, henchman 20%), rarity rolled server-side; 3 equipped,
  one per head/back/chest, runes stack; 30 slots, a full bag loses the drop. Worn gear REPLACES the suit's own
  accessory on the same mount (`SuitBody.attachmentsFor`), so meshes never overlap.
- **No overlapping solids.** Every solid is in `shared/src/config/map.ts`; the client draws exactly those boxes. Floor
  decals in stages are lifted per decal so two never share a plane. The training district's miniature town
  (`TRAINING_TOWN`: walk-ups, shops, cars, trees, lamps, hydrants, lights) is solids too; `verify-progression` checks
  they overlap nothing, stay off the pads, leave each pad's view of its tower clear and every pad walkable.
- **The city is generated, not modelled.** `client/src/world/NycBuildings.ts` (four canvas facades, building styles,
  landmarks, merged per `CityKit`) placed by `CityLayout.ts`: ring 1 on the plaza's wall solids (trim may reach
  only into the 1-unit slack; none behind the boards or the WEB TRAINING sign), the flush storefront row on the
  portal wall (no gaps: they would show the street through the wall), ring 2, the skyline; per arena, an avenue and
  two rows beyond x 138 (built with the arena dressing). Glow parts are unfogged: none on far silhouettes.
- **The crouch is grounded by measurement**: `CROUCH.bobY` was fitted so the skinned mesh's lowest vertex sits on
  the street. Changing the pose means re-measuring (min Y of `SkinnedMesh.getVertexPosition` over the body).
- **Responsive HUD: one unit** `--u` (`hudStyles`); the Spider HUD/windows live in `client/src/ui/spiderStyles.ts`.
  Touch mode lifts the stick/buttons above the level bar (portrait) or narrows the bar between them (landscape).

## Layout facts (`shared/src/config/map.ts`)

- Spawn (0,0,0) faces +Z; the camera's RIGHT is -X. Training district LEFT (x 40..104): six buildings, pads 10 units
  in front (-X). Suit Upgrades RIGHT (x -38..-78): 7/6/6 pads on three storeys, statue behind each. Back (-Z): six egg
  pedestals (z -54) under the two boards (Highest Playtime, Highest Damage) on the back wall. Web Shooter stand
  back-left (86, -58). Walkable rooftops (with water towers) in the front corners and back-right. Portal at z 44;
  30 arenas every 104 units.

## Verification before calling anything done

`npm run typecheck && npm run verify && npm run build:client && npm run size:client`, then with `npm run dev`
running: `npm run verify:capacity`, `npm run verify:multiplayer`, `npm run verify:run`; and `npm run verify:persistence`
after any change to auth, persistence, join/leave/switch paths or the webhook.
