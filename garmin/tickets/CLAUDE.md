# Tickets for Garmin

- Connect IQ watch app (Monkey C, API 5.0), product `venu2s` (Martin's watch). Not in apps/: `_build.yaml` builds every apps/*; `garmin/**` is ignored by the production release.
- Talks only to `apps/tickets/server` `/api/watch/*` (see `apps/tickets/CLAUDE.md`). Session in `Application.Storage`, sync only on app start / the Refresh page (Martin's wish, no background service).
- Device profiles and fonts come from SDK Manager (Garmin login) and are Garmin-licensed: never commit them. SDK itself downloads without login from developer.garmin.com/downloads/connect-iq/sdks/sdks.json.
- UI (Martin 2026-11-26): one vertical row of pages in `PagesView`: QR of each code (nearest event first), then Refresh, Sign out; signed out = only Sign in. Swipe up/down pages, tap = action.
- `module` is a reserved word in Monkey C.
