# Smallhill Apps

- Each app is an independent project in `apps/<name>` (own package.json, lockfile, prettier, .nvmrc), package `@smallhillcz/<name>`, served at `https://apps.smallhill.cz/<name>/`. No npm workspaces unless truly needed.
- Each app has `.github/workflows/app.<name>.yaml` (tests on changes in `apps/<name>/`). New app: copy `app.tuner.yaml`.
- One image `ghcr.io/smallhillcz/smallhill-apps` holds everything (`docker/`, release workflows from SmallhillCZ/skeletons, Watchtower pulls it). `_build.yaml` builds every app with `--base-href /<name>/` (portal `/`); apps with an npm `serve` script run as Node behind the image nginx with `PORT`/`BASE_PATH` and `<NAME>_*` env vars un-prefixed. Don't hardcode `baseHref`; no per-app Dockerfiles needed.
- `apps/portal` is the home page at the root; register every new app in `apps/portal/src/app/apps.ts`.
