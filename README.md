# Star Intersection

> **Star Intersection (called Star)** is a local-first personal planning app for shaping an hourly week while keeping important calendar events, deadlines, and “do later” thoughts close at hand. It is designed for personal use across a MacBook, Windows laptop, and Android phone. **Current version: 0.3.0 (installable web prototype).**

## Project status

The planner is live at [star-intersection-momomoyai.web.app](https://star-intersection-momomoyai.web.app). It saves immediately in this browser and syncs signed-in plans through the project's Firebase database. The current app is a PWA; a native tray app and reminders while fully closed are future work.

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

**Import screenshot** suggests activities from a table image with weekday headers and hourly labels. The image is processed in the browser; OCR code and language data download on first use. The parser currently reads English and Indonesian day names. When the hour grid is clear, it uses cell borders to recover merged block durations; otherwise it suggests one-hour blocks. Small text and OCR mistakes still require review. Edit or remove suggestions before saving. Nothing from the screenshot is added to Calendar automatically.

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

## Use across devices

1. Open [Star Intersection](https://star-intersection-momomoyai.web.app) on the first device. In **Settings → Cross-device sync**, choose **Create account** with an email and password.
2. On the MacBook, Windows laptop, and Android phone, open that same URL and sign in with the same account. The site can be installed from the browser's app menu on supported devices.
3. Keep a JSON export from **Settings** as a separate backup. Sync occurs after edits, when the app regains focus or connectivity, and periodically while it is open; open the app to catch up after a device has been offline.

The Firebase project `star-intersection-momomoyai` has Email/Password Authentication, a Firestore database in Jakarta, and [firestore.rules](firestore.rules) deployed. Rules limit each account to its own `users/{uid}/items` documents. A temporary account passed a live sign-up, write, read, and anonymous-access check on 2026-11-24; it and its test document were deleted.

For a new local build, copy [`.env.example`](.env.example) to `.env.local`, fill in the project's Firebase Web app API key and project ID, and run `node scripts/build.mjs`. The local `.env.local` already used for this deployment is ignored by Git. To redeploy, use the official Firebase CLI: `firebase login`, `node scripts/build.mjs`, then `firebase deploy --only hosting,firestore:rules,auth` from the repository root. [firebase.json](firebase.json) serves only `dist/`.

**Configuration safety:** `.env.local`, generated `config.js`, and `dist/` are ignored by Git. The build copies only eight allowlisted browser files. The Firebase Web API key is a public browser identifier and appears in the deployed `config.js`; Firestore rules and Authentication protect private plans. Never put a password, service-account key, or other private credential in the env file. The browser stores a Firebase refresh token locally to resume sign-in, so use a private browser profile on shared computers.

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
| [.firebaserc](.firebaserc), [firebase.json](firebase.json), [firestore.rules](firestore.rules) | Firebase project, hosting, authentication, and per-user data rules |

## Next milestones

- Test offline edits and sync on two real devices signed into the same account.
- Improve screenshot OCR for merged cells and add a direct Google Sheets import option.
- Prototype a low-memory desktop tray wrapper and measure RAM use.
- Add reminders that work when the desktop app is closed, plus Android notification support.
- Add account recovery and clearer sync conflict handling.

## Change log

- **0.3.0 — 2026-11-24:** Connect the live Firebase project, deploy private cross-device sync, refresh plans when the app regains focus, and publish the installable site.
- **0.2.1 — 2026-11-24:** Fix screenshot decoding for PNGs and detect table borders to recover merged activity durations.
- **0.2.0 — 2026-11-24:** Separate important events from weekly activities; add draft-based week planning, reusable templates, screenshot OCR suggestions, and a more helpful yellow Orbit.
- **0.1.0 — 2026-11-24:** First local-first planner, light observatory interface, Orbit mascot, optional Firebase sync path, and allowlisted build.
