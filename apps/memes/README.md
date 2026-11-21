# Memes

Your own meme library. Save pictures, GIFs and videos, tag them, find them in a second and send them to any chat app. Everything stays on the device. No ads, no tracking.

Part of [Smallhill Apps](../../README.md), served at https://apps.smallhill.cz/memes/.

## How it works

- Memes are stored in IndexedDB on the device; the whole library can be backed up to and restored from one ZIP file (`memes.json` + the files).
- Adding: Share from another app (installed PWA, Web Share Target handled in `public/sw.js`), file picker, paste or drag and drop.
- Sending: Share (Web Share API with files) to any chat app, Copy (PNG to the clipboard) or Save.

## Run locally

```sh
npm install
npm run dev     # app on :4200 (no service worker, so no share target)
npm test        # unit tests
```
