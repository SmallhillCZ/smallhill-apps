# Smallhill Apps

- Each app is an independent project in `apps/<name>` (own package.json, lockfile, prettier, .nvmrc), package `@smallhillcz/<name>`, served at `https://apps.smallhill.cz/<name>/`. No npm workspaces unless truly needed.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, `format:check`, `build`, `test` in every `apps/*` directory.
- `apps/portal` is the home page at the root; register every new app in `apps/portal/src/app/apps.ts`.
