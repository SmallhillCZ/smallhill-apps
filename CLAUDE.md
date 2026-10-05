# Smallhill Apps

- Each app is an independent project in `apps/<name>` (own package.json, lockfile, prettier, .nvmrc), package `@smallhillcz/<name>`, served at `https://apps.smallhill.cz/<name>/`. No npm workspaces unless truly needed.
- Each app has `.github/workflows/app.<name>.yaml`: tests (`npm ci`, `format:check`, `build`, `test`) on changes in `apps/<name>/`; manual dispatch releases DEV/PRODUCTION via shared `_*.yaml` workflows (from SmallhillCZ/skeletons). New frontend app: copy `app.tuner.yaml` (tests only).
- Base path is `/<name>/` from the folder name (portal `/`), passed as `ng build --base-href`; don't hardcode `baseHref`. Frontend-only apps have no Dockerfile: releasing Portal bundles them all into the portal nginx image (`/<name>/`), so a new frontend app goes live by merging it and releasing Portal (Watchtower pulls it). Apps with a backend have their own `Dockerfile` and container. Images carry Traefik + Watchtower labels; full server stack in `deploy/docker-compose.example.yml`.
- `apps/portal` is the home page at the root; register every new app in `apps/portal/src/app/apps.ts`.
