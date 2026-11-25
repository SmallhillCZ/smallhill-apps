# Tickets for Garmin

- Connect IQ watch app (Monkey C, API 5.0), product `venu2s` (Martin's watch). Not in apps/: `_build.yaml` builds every apps/*; `garmin/**` is ignored by the production release.
- Talks only to `apps/tickets/server` `/api/watch/*` (see `apps/tickets/CLAUDE.md`). Session in `Application.Storage`, sync only on app start / Menu → Refresh (Martin's wish, no background service).
- Device profiles and fonts come from SDK Manager (Garmin login) and are Garmin-licensed: never commit them. SDK itself downloads without login from developer.garmin.com/downloads/connect-iq/sdks/sdks.json.
- `module` is a reserved word in Monkey C.
