# Star Intersection

> **Star Intersection (called Star)** is a local-first personal planning app that brings an hourly weekly timetable, deadlines, calendar events, and “do later” thoughts into one calm place. It is designed for personal use across a MacBook, Windows laptop, and Android phone. **Current version: 0.1.0 (installable web prototype).**

## Project status

The planner works locally and keeps data in this browser. A Firebase sync path is implemented but requires a personal Firebase project and deployment before it can be used across devices. The current app is a PWA; a native tray app and reminders while fully closed are future work.

## What works

| Area | Current behavior |
| --- | --- |
| Today | Next event, scheduled timeline, due tasks, and quick capture |
| Week | Hourly grid with recurring or dated events; **Now** jumps to the current hour |
| Calendar | Month and year views; selecting a day shows its events and deadlines |
| Inbox | Undated thoughts, dated tasks, completion, and editing |
| Backup | JSON export and merge import |
| Reminder | Optional daily review notification while the app is open |
| Orbit | Contextual mascot with shortcuts to relevant views and quick capture |

Press `/` to focus quick capture or open the task editor. Settings can import an editable starting timetable transcribed from the November 23–29, 2026 screenshot. Review the imported times because some merged-cell boundaries were approximate.

## Run locally

Requires Node.js and Python 3. From this repository:

```sh
node scripts/build.mjs
cd dist
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173). On Windows, `py -m http.server 4173` can replace the last command. Re-run the build after changing source files. Serve `dist/`, not the repository root, so local environment files are not exposed by the preview server.

The app shell becomes available offline after the first successful visit. Local plans are stored in browser storage; use **Settings → Export JSON** for a backup.

## Enable cross-device sync

1. Create a [Firebase project](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) and a Cloud Firestore database. Review the current Spark plan limits before relying on it.
2. Enable [Email/Password Authentication](https://firebase.google.com/docs/auth/web/password-auth).
3. Publish the contents of [firestore.rules](firestore.rules) in Firestore Rules. The rule limits each signed-in user to their own `users/{uid}/items` documents.
4. Copy [`.env.example`](.env.example) to `.env.local`. Fill in the Firebase Web app API key and project ID. Run `node scripts/build.mjs`.
5. Serve or deploy `dist/` over HTTPS. Sign in to Star with the same account on each device.

For Firebase Hosting, install the official Firebase CLI, then run `firebase login`, `firebase use --add`, `node scripts/build.mjs`, and `firebase deploy --only hosting,firestore:rules` from the repository root. [firebase.json](firebase.json) serves only `dist/`.

**Configuration safety:** `.env.local`, generated `config.js`, and `dist/` are ignored by Git. The build copies only seven allowlisted browser files. The Firebase Web API key is a public browser identifier and appears in the deployed `config.js`; Firestore rules and Authentication protect private plans. Never put a password, service-account key, or other private credential in the env file. The browser stores a Firebase refresh token locally to resume sign-in, so use a private browser profile on shared computers.

## Data behavior

- Events have a date or weekly repeat days, plus a start and end time.
- Tasks may have a due date or remain undated in the Inbox.
- Edits save locally immediately. Sync runs after sign-in, after edits, when the device comes online, and while the app remains open.
- Each item is one Firestore document. If two offline devices edit the same item, the later device timestamp wins. Export backups before relying on the app for critical deadlines.
- Deletions use small tombstone records so they can sync to other devices.

## Repository map

| Path | Purpose |
| --- | --- |
| [app.js](app.js), [styles.css](styles.css) | Planner behavior and interface |
| [index.html](index.html), [manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js) | App shell, installation, offline cache |
| [scripts/generate-config.mjs](scripts/generate-config.mjs) | Read ignored env settings and generate local browser config |
| [scripts/build.mjs](scripts/build.mjs) | Copy only approved browser assets into `dist/` |
| [firebase.json](firebase.json), [firestore.rules](firestore.rules) | Hosting and per-user data rules |

## Next milestones

- Configure Firebase and test edits made offline on two real devices.
- Improve timetable import from Google Sheets instead of relying on a screenshot transcription.
- Prototype a low-memory desktop tray wrapper and measure RAM use.
- Add reminders that work when the desktop app is closed, plus Android notification support.
- Add account recovery and clearer sync conflict handling.

## Change log

- **0.1.0 — 2026-11-24:** First local-first planner, light observatory interface, Orbit mascot, optional Firebase sync path, and allowlisted build.
