# Places

Your Google Maps lists on a clean map. Paste the share link of a list and its places show up on a Mapy.com map, each list in its own colour, with your notes. No ads, no tracking.

Part of [Smallhill Apps](../../README.md), served at https://apps.smallhill.cz/places/.

## How it works

- Google Maps has no public API for lists, so `server/` is a small Fastify proxy that opens the share link and reads the list the same way the Google Maps list page does. Only public lists ("Send link to view") work.
- Lists and their last loaded places are kept on the device, so the map opens without signal.
- Map tiles come from [Mapy.com](https://developer.mapy.com/).

## Run locally

```sh
npm install
npm run dev:server   # API on :3000
npm run dev          # app on :4200, proxies /api to :3000
```

## API

| Method | Path                         |                                      |
| ------ | ---------------------------- | ------------------------------------ |
| GET    | `/api/list?url=…&lang=cs/en` | `{ id, title, description, places }` |
