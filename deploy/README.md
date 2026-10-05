# Deployment

Every app is its own container. Routing comes from labels baked into each image by the release workflow, so the server never needs reconfiguring when an app is added or changed.

- `Host(apps.smallhill.cz) && PathPrefix(/<app>/)` for apps with a `baseHref` of `/<app>/`, and `Host(apps.smallhill.cz)` for the portal (`baseHref` `/`). Longer rules win, so the portal only gets what no app claims.
- `/<app>` redirects to `/<app>/`.
- DEV images use `dev.apps.smallhill.cz`. Override with repo variables `APPS_HOST` and `APPS_DEV_HOST`.
- Every image has `com.centurylinklabs.watchtower.enable=true`, so Watchtower only touches app containers.

## One-time server setup

```sh
docker login ghcr.io
ACME_EMAIL=... WATCHTOWER_TOKEN=... docker compose -f deploy/compose.yaml up -d
```

This starts Traefik (ports 80/443, Let's Encrypt) and Watchtower on the `smallhill-apps` network. Watchtower's update API is exposed at `https://apps.smallhill.cz/v1/update`.

GitHub repo settings: variable `WATCHTOWER_URL=https://apps.smallhill.cz/v1/update`, secret `WATCHTOWER_TOKEN` (same value as on the server).

## Adding an app

Release it once from its workflow (Actions → app → Run workflow → `release-production`), then start its container once:

```sh
docker run -d --name tuner --restart unless-stopped --network smallhill-apps ghcr.io/smallhillcz/smallhill-apps-tuner:latest
```

Apps with their own services keep a compose file here, e.g. `POSTGRES_PASSWORD=... docker compose -f deploy/scheduler/compose.yaml up -d`.

Later releases are picked up by Watchtower automatically.
