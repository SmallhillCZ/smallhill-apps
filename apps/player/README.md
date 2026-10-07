# Player

Play music from your OneDrive. Angular PWA, no ads, no tracking: the browser signs in with Microsoft and streams files straight from OneDrive. A small Fastify server is only needed for playing on Sonos.

## Features

- Sign in with a personal or work/school Microsoft account (MSAL.js, redirect flow with PKCE, read-only `Files.Read`)
- One library with any number of OneDrive accounts and device folders as top-level folders (top folder, rename, remove)
- Browse OneDrive folders, play MP3 and other audio files (m4a, aac, ogg, opus, wav, flac)
- Device folders use the File System Access API in Chrome, Edge and Android, remembered; other browsers pick the folder each session)
- Each source's settings choose its top folder (e.g. Music); the last folder opens on start; OneDrive folder listings are cached locally
- Play a folder in order or shuffled, repeat all or one, seek
- Lock screen, notification and headphone controls (Media Session API)
- Auto, light, dark and E-ink themes (auto detects E-ink displays); English and Czech UI (by browser language, with a switch)
- Play the queue on Sonos (OneDrive tracks only), see below
- Language, theme and Sonos in the menu at the top right
- Installable (Angular service worker)

## Microsoft Entra app

Register an app in Microsoft Entra (App registrations, New registration):

- Supported account types: accounts in any organizational directory and personal Microsoft accounts
- Platform: Single-page application, redirect URIs `https://apps.smallhill.cz/player/` and `http://localhost:4200/`
- API permissions: Microsoft Graph, delegated `Files.Read` (and the default `User.Read`)

Put the Application (client) ID into `CLIENT_ID` in `src/app/config.ts`. The ID is public, not a secret.

## Sonos

Connect Sonos in the menu, then the speaker button in the player bar sends the queue to a Sonos room. It uses the [Sonos Control API](https://docs.sonos.com/) and a [cloud queue](https://docs.sonos.com/docs/cloud-queue-play-audio) served by `server/`:

- `api/sonos/login` and `api/sonos/callback`: OAuth with Sonos. The token exchange needs the client secret, so it runs on the server; the browser gets the tokens only as an AES-GCM sealed blob (`localStorage` `player.sonos`, header `X-Sonos-Token`), refreshed by the server.
- `api/sonos/queues`: the browser uploads the queue (OneDrive tracks with temporary Graph download URLs, refreshed by the browser every 30 min while casting), the server creates a playback session and loads the cloud queue; control and status go through the server too.
- `api/sonos/cq/<id>/v2.3/`: Cloud Queue API for the speakers (`context`, `itemWindow`, `version`, `timePlayed`, auth `Bearer <queue key>`); `media/<item>` redirects to the stored OneDrive URL. Queues live in Postgres table `player_sonos_queues`, deleted 2 days after the last update.

Device folder tracks are skipped. When the player page is closed, Sonos keeps playing until the stored OneDrive links expire (about an hour).

Setup: create a Control integration at [developer.sonos.com](https://developer.sonos.com) with redirect URI `https://apps.smallhill.cz/player/api/sonos/callback` and set `SONOS_CLIENT_ID` and `SONOS_CLIENT_SECRET` in the container env. Without them the Sonos menu item is hidden.

| Variable                                   | Default                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `SONOS_CLIENT_ID` / `SONOS_CLIENT_SECRET`  | unset (Sonos off)                                |
| `DATABASE_URL`                             | `postgres://player:player@localhost:5432/player` |
| `PUBLIC_URL`                               | derived from `Host` and `X-Forwarded-Proto`      |
| `PORT` / `HOST` / `BASE_PATH` / `WEB_ROOT` | `3000` / `0.0.0.0` / empty / unset               |

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev      # dev server on http://localhost:4200 (needs CLIENT_ID)
npm run demo     # dev server with sample folders and tones instead of OneDrive
npm run dev:server   # API on :3000 (ng serve proxies /api to it)
npm test         # unit tests (vitest) and server tests (needs Postgres DB player_test or TEST_DATABASE_URL)
npm run build    # typecheck the server and build into dist/player/browser
```

Deployed to https://apps.smallhill.cz/player/; the base path is passed at build time with `ng build --base-href /player/` and the redirect URI is derived from it.
