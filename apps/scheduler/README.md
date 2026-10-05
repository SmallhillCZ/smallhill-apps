# Scheduler

Find a time that works for everyone. The organiser suggests time slots, shares one link, and
participants mark each slot **Yes / If need be / No**. No accounts, no ads, no tracking.

Part of [Smallhill Apps](../../README.md), served at https://apps.smallhill.cz/scheduler/.

## How it works

- **Create**: pick days on a calendar, add one or more time ranges per day. Times are entered in
  the organiser's time zone and stored as UTC; everyone sees them in their own time zone.
- **Share**: the poll link (`/p/<id>`) is all participants need.
- **Answer**: name + a vote per slot. The browser keeps a private edit key so the person can change
  or remove their answer later from the same browser.
- **Manage**: the creator's browser keeps a private admin key. The admin can edit the poll
  (answers to kept slots survive), close/reopen it, choose the final time (closes the poll and
  offers an `.ics` "Add to calendar" download), remove answers, or delete the poll. An admin link
  (`/p/<id>?admin=<key>`) moves management to another device.
- **Privacy**: no cookies, no analytics, no IP logging. Keys are stored only as SHA-256 hashes.
  Polls are deleted automatically `RETENTION_DAYS` (default 60) after their last slot ends.

## Layout

| Path      | What                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`    | Angular 22 PWA (standalone components, signals, zoneless, service worker). Production `baseHref` is `/scheduler/`.                              |
| `server/` | Node 24 + Fastify + PostgreSQL. TypeScript runs natively via Node's type stripping, no build step. Also serves the built PWA under `BASE_PATH`. |

This app is a standalone project with its own `package.json` and lockfile, so changes here don't affect the other apps.

## Run locally

Requires Node 24 and PostgreSQL.

```sh
# database
createuser scheduler -P        # password: scheduler
createdb scheduler -O scheduler
createdb scheduler_test -O scheduler   # for tests

npm install
npm run dev:server   # API on :3000, creates tables on start
npm run dev          # app on :4200, proxies /api to :3000
```

Production-like: `npm run build && BASE_PATH=/scheduler npm start` → http://localhost:3000/scheduler/

Or in Docker: `docker compose up --build` → http://localhost:3000/scheduler/

## Configuration (server)

| Variable         | Default                                                   |
| ---------------- | --------------------------------------------------------- |
| `DATABASE_URL`   | `postgres://scheduler:scheduler@localhost:5432/scheduler` |
| `PORT` / `HOST`  | `3000` / `0.0.0.0`                                        |
| `BASE_PATH`      | empty (Docker image: `/scheduler`)                        |
| `WEB_ROOT`       | unset; directory of the built PWA to serve                |
| `RETENTION_DAYS` | `60`                                                      |

## Tests

```sh
npm run typecheck && npm test   # uses TEST_DATABASE_URL or the scheduler_test DB
```

## API

All paths are under `BASE_PATH`.

| Method | Path                            | Auth                          |                                                          |
| ------ | ------------------------------- | ----------------------------- | -------------------------------------------------------- |
| POST   | `/api/polls`                    | –                             | create → `{ id, adminKey }`                              |
| GET    | `/api/polls/:id`                | –                             | poll, slots, responses                                   |
| GET    | `/api/polls/:id/admin`          | `X-Admin-Key`                 | check an admin key                                       |
| PATCH  | `/api/polls/:id`                | `X-Admin-Key`                 | title, description, location, slots, closed, finalSlotId |
| DELETE | `/api/polls/:id`                | `X-Admin-Key`                 | delete poll                                              |
| POST   | `/api/polls/:id/responses`      | –                             | answer → `{ id, editKey }`                               |
| PUT    | `/api/polls/:id/responses/:rid` | `X-Edit-Key`                  | change answer                                            |
| DELETE | `/api/polls/:id/responses/:rid` | `X-Edit-Key` or `X-Admin-Key` | remove answer                                            |

Limits: 100 slots per poll, 300 answers per poll.

## Not done yet

- Rate limiting (do it at the reverse proxy for now).
- Translations (UI is English; dates and times already follow the browser locale).
