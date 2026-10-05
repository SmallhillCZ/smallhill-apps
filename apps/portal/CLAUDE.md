# Portal

- Home page served at the root of https://apps.smallhill.cz (base path passed at build time), no service worker so it never intercepts `/<app>/` navigations.
- App list in `src/app/apps.ts` (`color` = app signature colour from its manifest `theme_color`, tints tile and Install button; `listed: false` hides; missing `url` = coming soon); assets in `public/apps/<id>/`.
- Install via `navigator.install(url, url)` in `src/app/install.service.ts` (manifest id = app start URL); texts EN/CS in `src/app/i18n.ts`.
