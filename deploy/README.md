# Deployment

All apps run in one container, `ghcr.io/smallhillcz/smallhill-apps`, built by **Release to DEV / Release to PRODUCTION** (from SmallhillCZ/skeletons). The release builds every `apps/<name>` with `--base-href /<name>/` (portal at `/`):

- Apps without a `serve` script are static files served by nginx under `/<name>/`.
- Apps with a `serve` script (Scheduler) run as a Node process inside the same container on `127.0.0.1:3001+`, with `PORT`, `HOST` and `BASE_PATH=/<name>/` set; nginx proxies `/<name>/` to it. Container env vars prefixed with the app name are passed on without the prefix, e.g. `SCHEDULER_DATABASE_URL` becomes `DATABASE_URL` for Scheduler.

The image carries Traefik (`Host(apps.smallhill.cz)`, `tls=true`, plus `tls.certresolver` when the repo variable `TRAEFIK_CERT_RESOLVER` is set) and Watchtower labels, so Watchtower pulls every release.

## Server setup

[`docker-compose.example.yml`](docker-compose.example.yml) is the whole stack: Traefik (ports 80/443, Let's Encrypt), Watchtower, the portal, Tuner, and Scheduler with its own Postgres. Copy it to the server as `docker-compose.yml` and run:

```sh
docker login ghcr.io
ACME_EMAIL=... WATCHTOWER_TOKEN=... SCHEDULER_DB_PASSWORD=... docker compose up -d
```

Watchtower's update API is exposed at `https://apps.smallhill.cz/v1/update`. GitHub repo settings: variable `WATCHTOWER_URL=https://apps.smallhill.cz/v1/update`, secret `WATCHTOWER_TOKEN` (same value as on the server).

## Adding an app

Merge the app into `apps/<name>` (with its `app.<name>.yaml` test workflow), then run **Release to PRODUCTION**. Watchtower pulls the new image and the app is live at `/<name>/`. No server change, unless a server app needs a new env var (`<NAME>_...`) or database.
