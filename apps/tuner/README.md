# Tuner

Simple guitar, bass and violin tuner. Frontend-only Angular PWA, no ads, no tracking. Audio is analyzed locally in the browser.

## Features

- Instruments: guitar (EADGBE), bass (EADG), violin (GDAE), chromatic
- Automatic string detection or a locked target string
- Adjustable reference pitch A4 (415–466 Hz)
- English and Czech UI (by browser language)
- Installable and works offline (Angular service worker)

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev      # dev server on http://localhost:4200
npm test         # unit tests (vitest)
npm run build    # production build into dist/tuner/browser
```

Production builds use base href `/tuner/` for https://apps.smallhill.cz/tuner/. The service worker is enabled only in production builds. Serve `dist/tuner/browser` from any static host over HTTPS.
