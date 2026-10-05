# Scheduler

- Doodle-style time poll without accounts. Standalone project: own `package.json` and `package-lock.json`, not an npm workspace.
- Frontend: Angular 22 standalone + signals, zoneless, PWA, in `src/`. Production `baseHref` is `/scheduler/`; API URLs in `src/app/api.ts` are relative so they follow it.
- Server: Node 24 + Fastify + PostgreSQL in `server/`, plain TS run by Node type stripping (erasable syntax only, `.ts` import extensions). Schema in `server/schema.sql`, applied idempotently on start. `BASE_PATH` env sets the URL prefix; the server also serves the built app.
- Tests: `npm test` (needs Postgres DB `scheduler_test`, or `TEST_DATABASE_URL`; root CI provides a Postgres service). `npm run build` also typechecks the server.
- Admin/edit keys live only in the browser (`src/app/local-store.ts`); the DB stores SHA-256 hashes.
- Hosted at https://apps.smallhill.cz/scheduler/.
- Signature colour: blue `#3b5bdb` (manifest `theme_color`, icons, `--accent` in `src/styles.css`). Icons are rendered from `public/icon.svg`.
