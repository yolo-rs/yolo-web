# Browser sign-in (manual — user only)

The automation NEVER signs into Google/Microsoft/Mozilla accounts, never imports or
syncs a profile, and never reads/copies any `User Data` directory. Do this yourself.

## Chrome Canary
1. Launch: `Start-Process "$env:LOCALAPPDATA\Google\Chrome SxS\Application\chrome.exe"`
   (or Start menu > "Chrome Canary").
2. Top-right avatar > **Turn on sync...**.
3. Sign in with your Google account.
4. **Settings > You and Google > Sync and Google services > Manage what you sync**:
   choose **Customize sync** and pick (bookmarks, passwords, history, extensions, ...).
5. Confirm. Sync status shows under the avatar.

## Edge Canary
1. Launch from Start menu ("Microsoft Edge Canary") or
   `Start-Process "$env:LOCALAPPDATA\Microsoft\Edge SxS\Application\msedge.exe"`.
2. Top-right profile > **Sign in to sync data**.
3. Sign in with your Microsoft (or work/school) account.
4. **Settings > Profiles > Sync**: toggle categories (Favorites, Passwords,
   History, Open tabs, Extensions, Settings) individually.
5. Confirm sync is **On**.

## Firefox Nightly
1. Launch from Start menu ("Firefox Nightly").
2. Menu (hamburger) > **Sign in** (or **Sign in to Firefox**).
3. Enter your Mozilla account; verify by email if prompted.
4. Menu > **Settings > Sync**: choose what to sync (Bookmarks, History,
   Open Tabs, Logins, Add-ons, Settings).
5. Confirm "Syncing" is active.

## Notes
- Sign-in requires an interactive window and your credentials; it cannot and must
  not be scripted here.
- To keep automated browsing separate from your synced identity, run agent/headless
  sessions with a throwaway `--user-data-dir` (see `scripts/browsers/agent-browser.md`),
  never your default profile.
