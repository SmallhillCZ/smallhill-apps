# Deployment

Frontend-only apps (no `Dockerfile` in their folder) are bundled into the portal image: releasing Portal builds every such app with `--base-href /<app>/` and serves it from the portal's nginx under `/<app>/`. Apps with a backend (Scheduler) have their own `Dockerfile` and container. Routing comes from labels baked into each image by the release workflow.

- Each app is served under `/<app>/` (its folder name); `app.portal.yaml` sets `base_path: /`. The path is passed to the build as `BASE_PATH` (`ng build --base-href`) and to the Traefik rule `Host(apps.smallhill.cz) && PathPrefix(/<app>/)`, so it is not hardcoded in app code. Longer rules win, so the portal only gets what no app claims.
- `/<app>` redirects to `/<app>/`.
- DEV images use `dev.apps.smallhill.cz`. Override with repo variables `APPS_HOST` and ## Server setup

[`docker-compose.example.yml`](docker-compose.example.yml) is the whole stack: Traefik (ports 80/443, Let's Encrypt), Watchtower, the portal, Tuner, and Scheduler with its own Postgres. Copy it to the server as `docker-compose.yml` and run:

```sh
docker login ghcr.io
ACME_EMAIL=... WATCHTOWER_TOKEN=... SCHEDULER_DB_PASSWORD=... docker compose up -d
```

Watchtower's update API is exposed at `https://apps.smallhill.cz/v1/update`. GitHub repo settings: variable `WATCHTOWER_URL=https://apps.smallhill.cz/v1/update`, secret `WATCHTOWER_TOKEN` (same value as on the server).

## Adding an app

Frontend-only app, no server change: merge the app (with its `app.<name>.yaml` test workflow), then run **Portal → Run workflow → `release-production`**. Watchtower pulls the new portal image and the app is live at `/<name>/`.

App with a backend: give it a `Dockerfile` and add its service to the server compose file once; later releases are pulled by Watchtower.
