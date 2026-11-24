# Star Intersection

> **Star Intersection (called Star)** is a local-first personal planning app for shaping an hourly week while keeping important calendar events, deadlines, and “do later” thoughts close at hand. It is designed for personal use across a MacBook, Windows laptop, and Android phone. **Current version: 0.2.0 (installable web prototype).**

## Project status

The planner works locally and keeps data in this browser. A Firebase sync path is implemented but requires a personal Firebase project and deployment before it can be used across devices. The current app is a PWA; a native tray app and reminders while fully closed are future work.

## What works

| Area | Current behavior |
| --- | --- |
| Today | Next timed block, activity and event timeline, due tasks, and quick capture |
| Week | Hourly grid with activities and important calendar events; overlapping blocks remain visible |
| Plan week | Draft a week manually, apply an editable template, or import suggested activities from a screenshot |
| Calendar | Month and year views for important events and task deadlines; ordinary activities stay in Week |
| Inbox | Undated thoughts, dated tasks, completion, and editing |
| Backup | JSON export and merge import |
| Reminder | Optional daily review notification while the app is open |
| Orbit | Yellow star companion that spots overdue tasks or an unplanned upcoming week and opens the right action |

Press `/` to focus quick capture or open the task editor. In **Week**, choose **Plan shown week** or **Plan upcoming week**. Add activities in the draft, select **Add template** to copy regular chores, or edit the reusable template itself. Important calendar events appear in the draft automatically and remain separate from ordinary activities. Save the week when the blocks look right.

**Import screenshot** suggests activities from a table image with weekday headers and hourly labels. The image is processed in the browser; OCR code and language data download on first use. The parser currently reads English and Indonesian day names. It estimates one-hour blocks from detected rows, so merged cells, small text, and OCR mistakes require review. Edit or remove suggestions before saving. Nothing from the screenshot is added to Calendar automatically.

## Run locally

Requires Node.js and Python 3. From this repository:

```sh
node scripts/build.mjs
cd dist
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173). On Windows, `py -m http.server 4173` can replace the last command. Re-run the build after changing source files. Serve `dist/`, not the repository root, so local environment files are not exposed by the preview server.

The app shell becomes available offline after the first successful visit. Manual week planning and templates work offline. Screenshot import needs a connection when its OCR assets are not yet cached. Local plans are stored in browser storage; use **Settings → Export JSON** for a backup.

Run the focused planner and screenshot parser checks with `node --test tests/*.test.mjs`.

## Enable cross-device sync

1. Create a [Firebase project](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) and a Cloud Firestore database. Review the current Spark plan limits before relying on it.
2. Enable [Email/Password Authentication](https://firebase.google.com/docs/auth/web/password-auth).
3. Publish the contents of [firestore.rules](firestore.rules) in Firestore Rules. The rule limits each signed-in user to their own `users/{uid}/items` documents.
4. Copy [`.env.example`](.env.example) to `.env.local`. Fill in the Firebase Web app API key and project ID. Run `node scripts/build.mjs`.
5. Serve or deploy `dist/` over HTTPS. Sign in to Star with the same account on each device.

For Firebase Hosting, install the official Firebase CLI, then run `firebase login`, `firebase use --add`, `node scripts/build.mjs`, and `firebase deploy --only hosting,firestore:rules` from the repository root. [firebase.json](firebase.json) serves only `dist/`.

**Configuration safety:** `.env.local`, generated `config.js`, and `dist/` are ignored by Git. The build copies only eight allowlisted browser files. The Firebase Web API key is a public browser identifier and appears in the deployed `config.js`; Firestore rules and Authentication protect private plans. Never put a password, service-account key, or other private credential in the env file. The browser stores a Firebase refresh token locally to resume sign-in, so use a private browser profile on shared computers.

## Data behavior

- Important events have a date, start, and end time. They appear on Calendar, Week, and Today.
- Activities fill the hourly Week and Today schedule. Dated activities can be assembled in the week planner; legacy repeating activities continue to appear in Week.
- Templates hold regular activities. Applying a template copies its blocks into the current draft. Editing a template does not rewrite saved weeks.
- Tasks may have a due date or remain undated in the Inbox.
- Edits save locally immediately. Sync runs after sign-in, after edits, when the device comes online, and while the app remains open.
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
| [firebase.json](firebase.json), [firestore.rules](firestore.rules) | Hosting and per-user data rules |

## Next milestones

- Configure Firebase and test edits made offline on two real devices.
- Improve screenshot OCR for merged cells and add a direct Google Sheets import option.
- Prototype a low-memory desktop tray wrapper and measure RAM use.
- Add reminders that work when the desktop app is closed, plus Android notification support.
- Add account recovery and clearer sync conflict handling.

## Change log

- **0.2.0 — 2026-11-24:** Separate important events from weekly activities; add draft-based week planning, reusable templates, screenshot OCR suggestions, and a more helpful yellow Orbit.
- **0.1.0 — 2026-11-24:** First local-first planner, light observatory interface, Orbit mascot, optional Firebase sync path, and allowlisted build.
