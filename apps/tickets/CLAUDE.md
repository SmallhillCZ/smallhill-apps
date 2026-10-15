# Tickets

- Shows the user's GoOut (goout.net) tickets; built for Android e-ink readers since GoOut only has an iOS app. Standalone project, not an npm workspace.
- Frontend: Angular 22 standalone + signals, zoneless, PWA in `src/`. API URLs are relative to `<base href>`. Themes auto/light/dark/eink (`src/app/theme.ts`, eink auto-detected). Texts EN/CS in `src/app/i18n.ts`.
- Server: Node 24 + Fastify in `server/`, no DB. It only proxies GoOut (no CORS there): `POST /services/user/auth/v2/login` `{username,password}`, `GET /services/saleform/purchase/v2/list?current=true`, ticket `url.pdf`. GoOut auth is cookie based; the server returns the GoOut cookies to the client as an opaque `x-goout-session` value (base64 JSON) and passes refreshed cookies back in the same header. Password is never stored or logged.
- Client caches the ticket list and rendered ticket images (pdf.js legacy build, for old WebViews) in localStorage so tickets open offline. A `text/html` reply for the PDF means GoOut emailed the tickets instead (`202 emailed`).
- `GOOUT_URL` env overrides https://goout.net (local fake for screenshots/tests). Tests: `npm test` (mocked fetch).
- Signature colour raspberry `#c2255c`. Icons rendered from `public/icon.svg`.
