# Memes

- Personal meme library (CS "Memy"), FE only. Angular 22 standalone + signals, zoneless, no router. Texts EN/CS in `src/app/i18n.ts`, themes auto/light/dark.
- Memes (image/_, video/_) live in IndexedDB `memes`/store `memes` (`src/app/db.ts`), record = `Meme` in `src/app/library.ts` (blob, title, tags, added, used, uses). Pure logic (search, tags, file names) in `library.ts`, ZIP backup writer/reader in `zip.ts`; both tested with `node --test` (`npm test`).
- Share Target: manifest `share_target` POSTs to `share-target`; `public/sw.js` handles that POST (writes to the same IndexedDB, redirects to `./?shared=<ids>`) and then `importScripts("ngsw-worker.js")`. The app registers `sw.js`, not `ngsw-worker.js`. Keep the DB schema in `sw.js` in sync with `db.ts`.
- Sending: Web Share API with files, fallback download; copy writes PNG to the clipboard (GIFs become a still frame, videos can't be copied).
- Signature colour red `#e03131`. Icons rendered from `public/icon.svg`.
