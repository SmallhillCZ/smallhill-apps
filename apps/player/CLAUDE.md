# Player

- Angular 22 standalone + signals, PWA. OneDrive MP3 player, no backend.
- Auth: `@azure/msal-browser` (lazy-loaded) redirect flow, authority `common`, scope `Files.Read`, client ID in `src/app/config.ts` (empty = "not set up" screen). Redirect URI = document base URI.
- Graph calls in `src/app/onedrive/onedrive.service.ts`; playback uses fresh `@microsoft.graph.downloadUrl` (cached 45 min, next track prefetched). `npm run demo` swaps in `onedrive.service.demo.ts` (sample tree, generated tones) via angular.json `demo` configuration; used for screenshots.
- Queue logic pure in `src/app/player/queue.ts`; audio + Media Session in `player.service.ts`.
- Signature colour `#7048e8` (violet). Texts EN/CS in `src/app/i18n.ts`. Prettier: tabs, double quotes, width 120.
