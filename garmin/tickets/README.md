# Tickets for Garmin

Connect IQ watch app showing GoOut ticket QR codes from [Tickets](../../apps/tickets/) on a Garmin Venu 2S. Only for personal use, sideloaded, not in the Connect IQ Store.

- Sign in: the watch opens `https://apps.smallhill.cz/tickets/api/watch/login` on the phone (`makeOAuthRequest`) and keeps the GoOut session.
- Tickets are downloaded only when the app is opened (or from the Refresh page at the end), through Garmin Connect on the phone, and stored on the watch, so the QR shows without the phone.
- QR comes from the server as a module matrix and is drawn on a white screen with full backlight.
- Texts CS + EN, chosen by the watch language.

## Build

1. [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) (no account needed) and the `venu2s` device profile from SDK Manager (needs a Garmin account) in `~/.Garmin/ConnectIQ/Devices/`.
2. Developer key, once: `openssl genrsa -out dev_key.pem 4096 && openssl pkcs8 -topk8 -inform PEM -outform DER -in dev_key.pem -out dev_key.der -nocrypt` (keep it out of git).
3. `monkeyc -f monkey.jungle -d venu2s -y dev_key.der -o bin/Tickets.prg`

## Install

Connect the watch by USB (MTP; on macOS use OpenMTP) and copy `bin/Tickets.prg` to `GARMIN/APPS/`.
