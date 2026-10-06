# Player

Play music from your OneDrive. Frontend-only Angular PWA, no ads, no tracking, no backend: the browser signs in with Microsoft and streams files straight from OneDrive.

## Features

- Sign in with a personal or work/school Microsoft account (MSAL.js, redirect flow with PKCE, read-only `Files.Read`)
- One library with any number of OneDrive accounts and device folders as top-level folders (rename, remove)
- Browse OneDrive folders, play MP3 and other audio files (m4a, aac, ogg, opus, wav, flac)
- Device folders use the File System Access API in Chrome, Edge and Android, remembered; other browsers pick the folder each session)
- Set a music folder that opens on start; OneDrive folder listings are cached locally
- Play a folder in order or shuffled, repeat all or one, seek
- Lock screen, notification and headphone controls (Media Session API)
- Auto, light, dark and E-ink themes (auto detects E-ink displays); English and Czech UI (by browser language, with a switch)
- Installable (Angular service worker)

## Microsoft Entra app

Register an app in Microsoft Entra (App registrations, New registration):

- Supported account types: accounts in any organizational directory and personal Microsoft accounts
- Platform: Single-page application, redirect URIs `https://apps.smallhill.cz/player/` and `http://localhost:4200/`
- API permissions: Microsoft Graph, delegated `Files.Read` (and the default `User.Read`)

Put the Application (client) ID into `CLIENT_ID` in `src/app/config.ts`. The ID is public, not a secret.

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev      # dev server on http://localhost:4200 (needs CLIENT_ID)
npm run demo     # dev server with sample folders and tones instead of OneDrive
npm test         # unit tests (vitest)
npm run build    # production build into dist/player/browser
```

Deployed to https://apps.smallhill.cz/player/; the base path is passed at build time with `ng build --base-href /player/` and the redirect URI is derived from it.
