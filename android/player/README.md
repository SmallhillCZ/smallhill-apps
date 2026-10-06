# Player for Android

Native Android version of the [web Player](../../apps/player): plays music from OneDrive through a Media3 `MediaLibraryService`, so the library and playback also work from the notification, lock screen, Bluetooth controls and Android Auto.

- Kotlin, Jetpack Compose, Media3 (ExoPlayer + MediaLibraryService), no server.
- Sign-in: OAuth 2.0 authorization code with PKCE in a Custom Tab, redirect `cz.smallhill.player://auth`, same Entra app as the web Player (`a3e7e477-7aba-4c4b-a605-726a61e06edc`, scope `Files.Read`).
- Library tree: root → OneDrive accounts (top folder per account) → folders → tracks. Tracks use `onedrive://<account>/<item>` URIs resolved to Graph download URLs when ExoPlayer opens them.
- UI in Czech and English, following the system language (per-app language in Android settings).

## Entra setup

In the app registration add the platform **Mobile and desktop applications** with the custom redirect URI `cz.smallhill.player://auth`.

## Build

```sh
./gradlew assembleDebug testDebugUnitTest lintDebug
```

CI (`.github/workflows/android.player.yaml`) builds the debug APK and uploads it as the `player-debug-apk` artifact. The debug keystore is committed so every CI build can update an installed APK.
