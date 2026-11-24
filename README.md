# Star Intersection

A small, dependency-free personal planner. It has a Today dashboard, an hourly week, month and year calendars with day details, and an Inbox for tasks without dates. Changes save immediately in this browser. The app shell works offline after the first visit.

The interface uses a light observatory theme with blue, teal, violet, and soft yellow accents. Orbit, the small star mascot, shows a contextual note about due tasks or the next event and offers shortcuts to Today and quick capture. Today shows live counts for scheduled events, due tasks, and undated thoughts. Week opens near the current hour; **Now** returns there, and pressing `/` opens quick capture or the task editor.

## Run locally

From this folder:

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`. Do not open `index.html` directly; offline installation and service workers need an HTTP origin. The app can be installed from a supported browser's **Install app** or **Add to Home Screen** menu.

Open **Settings → Import this week** to add the November 23–29, 2026 timetable from the screenshot. It adds dated, editable events. Some boundaries in the merged cells were approximate, so review them. The import runs only once per browser profile. **Export JSON** makes a backup; **Import JSON** merges a backup by item ID.

## Enable sync

The local app works without an account. To sync across Mac, Windows, and Android:

1. Create a Firebase project on the **Spark** plan and create a Cloud Firestore database. [Firebase says Spark does not require payment information and includes no-cost quotas](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). Keep the project on Spark if you want to avoid charges.
2. Enable **Authentication → Sign-in method → Email/Password** in the Firebase console. [Firebase's setup guide](https://firebase.google.com/docs/auth/web/password-auth).
3. In **Firestore → Rules**, replace the rules with the contents of `firestore.rules` and publish them. The rule only lets a signed-in user access `users/{their-uid}/items`. [Firebase's rules guide](https://firebase.google.com/docs/firestore/security/rules-conditions).
4. Register a Web app in Firebase. Copy its **Web API key** and **Project ID** into `config.js`, using `config.example.js` as the template. The web API key identifies the Firebase project; the Firestore rules enforce access to private data.
5. Serve or host this same folder over HTTPS on each device. Firebase Hosting can use `firebase.json` in this repo. Sign in with the **same email and password** on every device. The app syncs on sign-in, when online, after edits, and every minute while open.

For Firebase Hosting, install the official Firebase CLI, then run `firebase login`, `firebase use --add`, and `firebase deploy --only hosting,firestore:rules` from this folder. The app needs your project ID and your Firebase account before this deployment can be completed.

Sync keeps one Firestore document per item. If the same item is edited offline on two devices, the later device timestamp wins. Export backups regularly if your plans are important. Deleted items remain as small sync tombstones. Each browser profile is bound to its first sync account to prevent uploading one account's local plans into another account.

## Current scope

This is an installable web app and a working local-first prototype. Settings includes an opt-in daily review notification while the app is open. It does **not** yet provide a native desktop tray, notifications while fully closed, or a measured low-memory Tauri build. The week import is based on the screenshot, not a live Google Sheets connection. A native wrapper can use these same static files after the workflow feels right.

The app uses Firebase's [Authentication REST API](https://firebase.google.com/docs/reference/rest/auth/) and [Firestore REST API](https://firebase.google.com/docs/firestore/use-rest-api), so there are no package dependencies to install. It stores the Firebase refresh token in this browser's local storage so your session can resume; use a private browser profile on a shared computer.
