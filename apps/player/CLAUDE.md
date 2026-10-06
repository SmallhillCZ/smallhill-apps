# Player

- Angular 22 standalone + signals, PWA. OneDrive MP3 player, no backend.
- Auth: `@azure/msal-browser` (lazy-loaded) redirect flow, authority `common`, scope `Files.Read`, client ID in `src/app/config.ts` (empty = "not set up" screen). Redirect URI = document base URI.
- Graph calls in `src/app/onedrive/onedrive.service.ts`; playback uses `@microsoft.graph.downloadUrl` from a plain item GET (`$select` drops it on personal OneDrive; fallback: `/content` blob), cached 45 min, next track prefetched, one retry on audio error.
- Library = list of sources (`src/app/sources.ts`, localStorage `player.sources`): each OneDrive account (MSAL multi-account, `homeAccountId`) and each device folder is a top-level folder; path[0] is the source. Music folder `player.music`, last location `player.location`. Old single `device` handle migrated on start.
- OneDrive listings cached in IndexedDB `folders` keyed `sourceId/folderId` (`folder-cache.ts`).
- Device folders (`src/app/device/device.service.ts`): File System Access handles in IndexedDB `handles` keyed by source id, permission re-requested on tap; fallback `webkitdirectory` input, session only. Both services expose `children(sourceId, folderId)` + `downloadUrl(sourceId, id)`. `npm run demo` swaps in `onedrive.service.demo.ts` (two demo accounts, sample tree, generated tones) via angular.json `demo` configuration.
- Folder and source navigation is pushed to browser history (`history.state` only, URL untouched so MSAL redirect hashes are safe); popstate restores it.
- Queue logic pure in `src/app/player/queue.ts`; audio + Media Session in `player.service.ts`.
- Signature colour `#7048e8` (violet). Themes auto/light/dark/eink (`theme.ts` copied from Tuner: auto switches to eink on `(update: slow), (monochrome)`); eink = white, black borders, no shadows or animations. Texts EN/CS in `src/app/i18n.ts`. Prettier: tabs, double quotes, width 120.
