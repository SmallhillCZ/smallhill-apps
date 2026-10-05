# Tuner

- Angular 22 standalone + signals, PWA via @angular/service-worker. Node >= 22.22.3 / 24.15.
- Pitch detection: YIN in `src/app/tuning/pitch-detector.ts`; notes/instruments in `notes.ts`; mic loop in `tuner.service.ts`.
- UI texts EN/CS in `src/app/i18n.ts`. Icons generated from `public/icons/icon.svg`.
- Hosted at https://apps.smallhill.cz/tuner/ (production baseHref `/tuner/`).
- Independent project inside smallhill-apps; prettier: tabs, double quotes, width 120.
