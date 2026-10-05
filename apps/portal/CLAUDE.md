# Portal

- Home page served at the root of https://apps.smallhill.cz (baseHref `/`), no service worker so it never intercepts `/<app>/` navigations.
- App list in `src/app/apps.ts` (`listed: false` hides an app, missing `url` = coming soon); assets in `public/apps/<id>/`.
- Install via `navigator.install(url, url)` in `src/app/install.service.ts` (manifest id = app start URL); texts EN/CS in `src/app/i18n.ts`.
