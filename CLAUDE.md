# Smallhill Apps

- npm workspaces monorepo; each app in `apps/<name>`, package `@smallhillcz/<name>`, served at `https://apps.smallhill.cz/<name>/` (Angular prod `baseHref`).
- Node 24 (`.nvmrc`), single root `package-lock.json`. Root scripts: `build`, `test`, `format`, `format:check`.
- Prettier at root: tabs, double quotes, width 120. CI: `.github/workflows/ci.yml`.
