# +1 Spider Evolution

A browser multiplayer Spider-Man training game. Every web you shoot makes you stronger: web the miniature
New York buildings of the training district, web-swing across the plaza and its rooftops, buy nineteen
Spider-Man suits from the Classic Suit (+1 per click) to the Infinity Spider (+3M), upgrade your web shooters,
hatch pets from six eggs, loot villain gear, rebirth for permanent multipliers, and fight Spider-Man's rogues
across thirty New York stages for Trophies.

Three.js client, authoritative Colyseus server (15 players per room), hosted on Bloxity.

## Play

| Action | PC | Mobile |
| --- | --- | --- |
| Run | WASD / arrows | left stick |
| Jump | Space | JUMP |
| Web-swing | Space again in mid-air | JUMP again in mid-air |
| Shoot a web | click (hold) / F / E | WEB |
| Auto Click (locks on while swinging) | C | Auto Click button |
| Rebirth / Backpack / Teleport / Stats | R / B / T / J | left buttons |
| Music | M | Music button |

Standing on a training building's pad webs it automatically. Step onto a suit pad to buy or wear a suit,
onto an egg pad to hatch, up to the Web Shooter stand to shop, and onto a stage's gold pad (after defeating
every villain) to claim its Trophies. Standing still sinks Spider-Man into his crouch.

## Develop

```bash
npm install
npm run dev
```

Client on http://localhost:5189, server on :2589. See `CLAUDE.md` for the rules, verification scripts and
layout facts.

## Deploy (Bloxity Hosting)

`.github/workflows/deploy.yml` publishes on every push:

| Branch | Channel | Frontend | Backend (WebSocket) |
| --- | --- | --- | --- |
| `dev` | DEV | https://spider-evolution.dev.play.bloxity.io | wss://spider-evolution.dev.host.bloxity.io |
| `main` | PROD | https://spider-evolution.play.bloxity.io | wss://spider-evolution.host.bloxity.io |

Any other branch does not deploy. A manual run (Actions, "Run workflow") follows the same mapping.

The run is ordered `verify` -> `server` -> `frontend`: nothing publishes unless the typecheck, the verification
suites, the client build and the 12 MB budget pass, and the frontend is uploaded only after its backend rolled,
so the two halves of a push always ship together.

- **Backend:** the Colyseus server is built from the root `Dockerfile` and pushed to
  `ghcr.io/<owner>/spider-evolution-server:<channel>-<sha>`. It is rolled with
  `POST https://legion.bloxity.io/v1/apps/spider-evolution/deploy`, using the commit SHA as the version,
  `seatCap` 15 (the room size) and `maxReplicas` 5. Legion injects `PORT` and `MONGODB_URI`, and
  probes `/health`.
- **Frontend:** `client/dist` is built with that channel's WebSocket URL baked in, zipped with
  `index.html` at the root, and uploaded raw to
  `POST https://api.bloxity.io/v1/hosting/games/spider-evolution/frontend?channel=<channel>&version=<sha>`.

One-time setup:

1. Create the game `spider-evolution` on https://hosting.bloxity.io (My Games).
2. Add the repository secret `LEGION_DEPLOY_TOKEN` (the token from My Games, behind the eye icon).
3. After the first run, make the GHCR package `spider-evolution-server` public (repository, Packages,
   Package settings, Change visibility) so Legion can pull it.

Progress lives in the Legion-injected MongoDB, per channel, so deploys never reset players.
