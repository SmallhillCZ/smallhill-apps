# Tickets

Your GoOut tickets on Android and e-ink readers. GoOut only has an iOS app; this PWA signs in with your GoOut e-mail and password, lists the tickets you bought (today's on top) and shows the ticket with its QR code at the door. No ads, no tracking.

Part of [Smallhill Apps](../../README.md), served at https://apps.smallhill.cz/tickets/.

## How it works

- GoOut's web API has no CORS, so `server/` is a small Fastify proxy. It forwards the login once and hands GoOut's session cookies back to the browser as an opaque value. Nothing is stored on the server and the password is never saved.
- The ticket list and the rendered ticket pages are kept in the browser, so a ticket opens without signal.
- If GoOut decides to e-mail the ticket instead of serving the PDF, the app says so.

## Run locally

```sh
npm install
npm run dev:server   # proxy on :3000
npm run dev          # app on :4200, proxies /api to :3000
```

`GOOUT_URL` points the proxy at another host (default `https://goout.net`).

## API

| Method | Path                | Header            |                                   |
| ------ | ------------------- | ----------------- | --------------------------------- |
| POST   | `/api/login`        | –                 | `{ email, password }` → `session` |
| POST   | `/api/logout`       | `x-goout-session` | signs out at GoOut                |
| GET    | `/api/tickets`      | `x-goout-session` | upcoming paid tickets             |
| GET    | `/api/ticket?url=…` | `x-goout-session` | ticket PDF from goout.net         |
