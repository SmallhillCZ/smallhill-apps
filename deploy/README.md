# Deployment

Every app is its own container, built from `apps/<app>/Dockerfile`. Frontend-only apps (portal, tuner) use the same nginx Dockerfile; copy it for a new one. Routing comes from labels baked into each image by the release workflow, so the server never needs reconfiguring when an app is added or changed.

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

Release it once from its workflow (Actions → app → Run workflow → `release-production`), add it to the compose file as two lines and run `docker compose up -d`:

```yaml
  myapp:
    image: ghcr.io/smallhillcz/smallhill-apps-myapp:latest
    restart: unless-stopped
```

No routing config is needed: the image carries its Traefik labels. Later releases are picked up by Watchtower automatically.
