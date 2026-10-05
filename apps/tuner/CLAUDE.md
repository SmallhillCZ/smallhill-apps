# Tuner

- Angular 22 standalone + signals, PWA via @angular/service-worker. Node >= 22.22.3 / 24.15.
- Pitch detection: YIN in `src/app/tuning/pitch-detector.ts`; notes/instruments in `notes.ts`; mic loop in `tuner.service.ts`.
- Signature colour `#e8892b` (amber): manifest theme_color, icon background, UI accent.
- Themes auto/light/dark/eink via `data-theme` on <html> (`src/app/theme.ts`); eink disables all transitions except the gauge needle.
- UI texts EN/CS in `src/app/i18n.ts`. Icons generated from `public/icons/icon.svg`.
- Hosted at https://apps.smallhill.cz/tuner/ (base path passed at build time: `ng build --base-href $BASE_PATH`).
- Independent project inside smallhill-apps; prettier: tabs, double quotes, width 120.
