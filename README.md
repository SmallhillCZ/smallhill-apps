# Smallhill Apps

Simple, ad-free, no-tracking apps served at https://apps.smallhill.cz.

## Apps

| App                 | Path      | Stack                |
| ------------------- | --------- | -------------------- |
| [Tuner](apps/tuner) | `/tuner/` | Angular PWA, FE only |

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev -w @smallhillcz/tuner
npm run build
npm test
```
