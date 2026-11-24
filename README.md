# Star Intersection

> **Star Intersection (called Star)** is a local-first personal planning app for shaping an hourly week while keeping important calendar events, deadlines, and “do later” thoughts close at hand. It is designed for personal use across a MacBook, Windows laptop, and Android phone. **Current version: 0.4.0.**

## Project status

The planner has a macOS menu bar app, a Windows tray build target, an Android build target, and the existing [web app](https://star-intersection-momomoyai.web.app). All package the same interface and use the same Firebase data format. Normal use of an installed app needs no local HTTP server or open browser tab. Each installation stores its own local copy and syncs after signing in.

## What works

| Area | Current behavior |
| --- | --- |
| Today | Next timed block, activity and event timeline, due tasks, and quick capture |
| Week | Hourly grid with activities and important calendar events; overlapping blocks remain visible |
| Plan week | Draft a week manually, apply an editable template, or import suggested activities from a screenshot |
| Calendar | Month and year views for important events and task deadlines; ordinary activities stay in Week |
| Inbox | Undated thoughts, dated tasks, completion, and editing |
| Backup | JSON export and merge import |
| Reminder | Optional daily review notification: background timer on desktop while the app runs; scheduled system notification on Android |
| Orbit | Yellow star companion that spots overdue tasks or an unplanned upcoming week and opens the right action |

Press `/` to focus quick capture or open the task editor. In **Week**, choose **Plan shown week** or **Plan upcoming week**. Add activities in the draft, select **Add template** to copy regular chores, or edit the reusable template itself. Important calendar events appear in the draft automatically and remain separate from ordinary activities. Save the week when the blocks look right.

**Import screenshot** suggests activities from a table image with weekday headers and hourly labels. OCR runs on the device. Native packages include the OCR code and language data, so screenshot import works offline; the web app downloads them on first use. The parser reads English and Indonesian day names. When the hour grid is clear, it uses cell borders to recover merged block durations; otherwise it suggests one-hour blocks. Review OCR mistakes before saving. Nothing from the screenshot is added to Calendar automatically.

## Install and use

### macOS

Build or unpack `Star-Intersection-0.4.0-macos-arm64.zip`, then drag **Star Intersection.app** into Applications and open it. This build is for Apple Silicon. The local build is unsigned, so on first launch use **Control-click → Open** and confirm macOS's prompt. Click the menu bar star for compact Today; its menu also offers **Capture thought**, **Open full planner**, and **Quit**. Closing the window hides it. **Settings → Launch at login in the tray** is optional.

### Android

Install the ARM64 APK with `adb install -r Star-Intersection-0.4.0-android-arm64.apk`, or open the APK on the phone and allow installation from that source. The app opens directly to Today; quick capture is at the top. Android may ask for notification permission when enabling the daily reminder. No Play Store account is needed for a direct personal install. On devices with Android's developer verification requirements, sideloading may also require the system's advanced installation flow.

### Windows

Build the same repository on Windows using the steps below. Install the generated NSIS `.exe`; the tray icon gives access to Today and quick capture. The Windows package cannot be built or tested from this macOS checkout.

The native apps have **separate local storage** from a browser or PWA. To bring existing data in, sign in to the same Star account and let sync finish. If some plans existed only in a browser, use **Settings → Export JSON** there and **Settings → Import JSON** in the native app. Export a backup before changing devices.

### Reminder limits

- **macOS and Windows:** the daily reminder works while Star is running, including with its window hidden in the tray. **Quit** stops the process and its reminder. Launch at login starts it hidden on the next sign-in, but does not run it after a full quit in the current session.
- **Android:** the reminder is scheduled with Android and may fire when Star is not open. Notification permission, battery management, reboot, and force-stop behavior vary by device. Opening Star again refreshes the schedule.
- **Web app:** its reminder still requires the page or installed PWA to be open.

Reminders are device settings, stored locally. Enable them separately on each device where you want a notification.

### Desktop memory check

On an 8 GB Apple M1 Mac running macOS 14.4.1, three idle samples of the installed native app and its two WebKit helper processes used **24–30 MiB summed RSS with the window visible** and **24–28 MiB after the window was hidden and startup had settled**; a later hidden sample set read **13–14 MiB**. An isolated Chrome app-mode profile opened at the deployed 0.4.0 URL read **455–470 MiB** across seven processes after several minutes. For context, an older, longer-idle Chrome profile with the 0.3.0 site read **99–120 MiB** across ten processes. Samples within each set were five seconds apart. These are process RSS totals, so shared pages can be counted more than once and macOS compression and profile age can change the number sharply. The native package size (31 MiB) was not used as a memory proxy. Repeat this measurement on the Windows laptop before assuming the same result there.

## Build from source

Clone this repository and copy `.env.example` to `.env.local`. Fill in the project's Firebase **Web app** API key and project ID; these are public client configuration, never a service-account key or password. Node.js 20+, pnpm, Rust stable, and the Tauri CLI are required. Build commands run from the repository root unless noted.

```sh
pnpm install --frozen-lockfile
node --test tests/*.test.mjs
cargo install tauri-cli --version '^2' --locked
```

For **macOS**, install Xcode Command Line Tools and run `cargo tauri build --bundles app --no-sign --ci`. The `.app` is in `src-tauri/target/release/bundle/macos/`. On Apple Silicon this produces an ARM64 build. For an Intel Mac, build on Intel or add the Intel Rust target and universal packaging. A signed, notarized distribution would require an Apple Developer account; this personal unsigned build does not.

For **Windows**, install Rust via rustup, Microsoft C++ Build Tools with the Desktop C++ workload, WebView2, Node.js, pnpm, and the Tauri CLI. In PowerShell, from the repository root:

```powershell
Copy-Item .env.example .env.local
# Edit .env.local with the same Firebase Web app config used by the other devices.
pnpm install --frozen-lockfile
node --test tests/*.test.mjs
cargo install tauri-cli --version '^2' --locked
cargo tauri build --bundles nsis --ci
```

Install the `.exe` in `src-tauri\target\release\bundle\nsis\`. WebView2 is included with current Windows versions; install the Evergreen Runtime if it is missing.

For **Android**, install Android Studio, Android SDK Platform 36 and Build Tools 36.0.0, Android NDK r30, JDK 17, Rust target `aarch64-linux-android`, and the Tauri CLI. The generated Android project is kept in `src-tauri/gen/android` for a reproducible build. On macOS/Linux:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk" # use your SDK path on Linux
export NDK_HOME="$ANDROID_HOME/ndk/30.0.16248370"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
rustup target add aarch64-linux-android
pnpm install --frozen-lockfile
cargo tauri android build --apk --debug -t aarch64 --ci
```

The APK is in `src-tauri/gen/android/app/build/outputs/apk/`. A debug APK is signed with Android's development key and is installable without a paid store account. Keep the debug key consistent when updating an existing install; a different key requires uninstalling first, which clears its local data. Sign in and sync or export JSON before uninstalling. For a production signed APK, create your own keystore outside the repository and follow [Tauri's Android signing guide](https://v2.tauri.app/distribute/sign/android/). The repository ignores keystores and local SDK paths.

The ARM64 APK packaged for this release is about 40 MiB. Its native library was stripped of debug symbols after compilation, then repackaged and signed by Gradle. A default debug build may be larger; this affects package size, not the app's data format.

For a **web preview**, run `node scripts/build.mjs`, then serve only `dist/` with `python3 -m http.server 4173`. This command is for development only. The web shell works offline after its first successful load, and screenshot import needs an initial OCR asset download. Native packages bundle those assets.

## Use across devices

1. In any version, open **Settings → Cross-device sync** and choose **Create account** with an email and password, or sign in to your existing Star account.
2. On the MacBook, Windows laptop, and Android phone, install the appropriate build and sign in with the same account.
3. Keep a JSON export from **Settings** as a separate backup. Sync occurs after edits, when the app regains focus or connectivity, and periodically while it is open; open the app to catch up after a device has been offline.

The Firebase project `star-intersection-momomoyai` has Email/Password Authentication, a Firestore database in Jakarta, and [firestore.rules](firestore.rules) deployed. Rules limit each account to its own `users/{uid}/items` documents. A temporary account passed a live sign-up, write, read, and anonymous-access check on 2026-11-24; it and its test document were deleted.

The local `.env.local` used for this deployment is ignored by Git. To redeploy the web app, use the official Firebase CLI: `firebase login`, `node scripts/build.mjs`, then `firebase deploy --only hosting` from the repository root. [firebase.json](firebase.json) serves only `dist/`.

**Configuration safety:** `.env.local`, generated `config.js`, native build outputs, and `dist/` are ignored by Git. The build copies only allowlisted browser files. The Firebase Web API key is a public browser identifier and is embedded in installed packages; Firestore rules and Authentication protect private plans. Never put a password, service-account key, or other private credential in the env file. Each installation stores a Firebase refresh token locally to resume sign-in, so use a private user account on shared computers.

## Data behavior

- Important events have a date, start, and end time. They appear on Calendar, Week, and Today.
- Activities fill the hourly Week and Today schedule. Dated activities can be assembled in the week planner; legacy repeating activities continue to appear in Week.
- Templates hold regular activities. Applying a template copies its blocks into the current draft. Editing a template does not rewrite saved weeks.
- Tasks may have a due date or remain undated in the Inbox.
- Edits save locally immediately. Sync runs after sign-in, after edits, when the app comes online or regains focus, and while it remains open.
- Each item is one Firestore document. If two offline devices edit the same item, the later device timestamp wins. Export backups before relying on the app for critical deadlines.
- Deletions use small tombstone records so they can sync to other devices.

## Repository map

| Path | Purpose |
| --- | --- |
| [app.js](app.js), [styles.css](styles.css) | Planner behavior and interface |
| [screenshot-import.js](screenshot-import.js) | Convert OCR table words into editable week suggestions |
| [index.html](index.html), [manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js) | App shell, installation, offline cache |
| [scripts/generate-config.mjs](scripts/generate-config.mjs) | Read ignored env settings and generate local browser config |
| [scripts/build.mjs](scripts/build.mjs) | Copy only approved browser assets into `dist/` |
| [scripts/build-native.mjs](scripts/build-native.mjs) | Bundle verified OCR assets for native offline use |
| [src-tauri](src-tauri) | macOS/Windows tray shell, Android wrapper, capabilities, and icons |
| [.firebaserc](.firebaserc), [firebase.json](firebase.json), [firestore.rules](firestore.rules) | Firebase project, hosting, authentication, and per-user data rules |

## Verification for 0.4.0

- **Real development Mac (Apple M1, macOS 14.4.1):** built, copied into Applications, and launched the unsigned `.app`. A native runtime probe exercised compact Today, the full Week planner, template action, Calendar, Inbox, bundled OCR worker, Firebase endpoint access, and hiding the window. Three RSS samples were taken with the window visible and hidden. The host's Screen Recording permission prevented a visual capture of its window; delivery of an actual reminder and a login restart were not observed.
- **Shared planner code:** five automated checks passed for week planning, screenshot parsing, and sync behavior. Bundled Tesseract processed the supplied timetable screenshot offline and produced 62 editable suggestions. The existing live Firebase account/write/read test from 0.3.0 covered the same sync code; this release did not repeat a signed-in cross-device round trip.
- **Android emulator:** the first debug APK installed and launched on API 34 and API 33 ARM64 emulators. Today rendered on API 33 with bottom navigation, quick capture, and Orbit. Both emulator images repeatedly raised **Android System UI** ANRs, which prevented reliable interaction testing of planning, persistence, sync, screenshot selection, and notification delivery. The final smaller APK passed ZIP and Android signature verification; it was not run on a physical phone.
- **Windows laptop and physical Android phone:** no build or device test was available here. Follow the build and installation steps above, then sign in with the same account and verify sync and notifications before relying on them for important plans.

## Next milestones

- Test offline edits and sync on two real devices signed into the same account.
- Test the Windows installer on a Windows laptop and the Android APK on a physical phone.
- Improve screenshot OCR for merged cells and add a direct Google Sheets import option.
- Improve reminder reliability after Android reboot and desktop Quit if needed.
- Add account recovery and clearer sync conflict handling.

## Change log

- **0.4.0 — 2026-11-24:** Package the existing planner in a Tauri 2 macOS menu bar/Windows tray and Android app, add compact Today and quick capture, keep the window accessible after close, add optional launch at login and native daily reminders, and bundle screenshot OCR for offline use. The same Firebase collection and local data format remain in use.
- **0.3.0 — 2026-11-24:** Connect the live Firebase project, deploy private cross-device sync, refresh plans when the app regains focus, and publish the installable site.
- **0.2.1 — 2026-11-24:** Fix screenshot decoding for PNGs and detect table borders to recover merged activity durations.
- **0.2.0 — 2026-11-24:** Separate important events from weekly activities; add draft-based week planning, reusable templates, screenshot OCR suggestions, and a more helpful yellow Orbit.
- **0.1.0 — 2026-11-24:** First local-first planner, light observatory interface, Orbit mascot, optional Firebase sync path, and allowlisted build.
