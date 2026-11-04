# Budget Tracker

An offline-first budget and expense tracker in pesos. It installs from the browser as an app (PWA) on Windows, Android and iPhone, works with no internet, and syncs between devices when you log in.

Stack: PostgreSQL 16 · Express (Node 24) · React (Vite) · Dexie (IndexedDB) · vite-plugin-pwa · Recharts. The full plan is in [PLAN.md](PLAN.md); rules for contributors (human or AI) are in [AGENTS.md](AGENTS.md).

## Run it on your PC

Needs Node 24, Docker Desktop and Git.

```powershell
copy .env.example .env          # then put real values in .env (see the comments in it)
docker compose up -d            # Postgres on 127.0.0.1:5434
cd server; npm install; npm run migrate; npm run dev    # API on http://localhost:4000
cd client; npm install; npm run dev                     # app on http://localhost:5173
```

Tests: `npm test` in `client/` (unit tests) and in `server/` (API tests; they create and use a separate `budget_test` database).

## Build the Android app (APK)

Needs JDK 21 and the Android SDK (platform 36, build-tools 36). Set `JAVA_HOME` and `ANDROID_HOME` first.

```powershell
cd client
$env:VITE_API_URL = 'https://budget.example.com'   # your server; leave this out for an offline-only build
npm run build:android
cd android; .\gradlew.bat assembleRelease
```

The signed file is `client/android/app/build/outputs/apk/release/app-release.apk`. To install it, copy it to an Android phone, open it, and allow installs from this source when asked. Google Play is not needed.

**Signing:** `client/android/keystore.properties` (git-ignored) points to the key. Back up the key and that file. If they are lost, phones can't update the app and would have to uninstall it, which erases anything not yet synced. Raise `versionCode` in `client/android/app/build.gradle` for every new APK.

## Deploy to your own server

Any Linux machine or Proxmox VM/LXC with Docker. HTTPS comes from a Cloudflare Tunnel, so no ports need to be opened on your router.

1. **Tunnel.** In the Cloudflare dashboard (your domain must be on Cloudflare): Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared. Copy the token. Add a public hostname, e.g. `budget.example.com`, with service `http://app:4000`.
2. **Code and secrets** on the server:
   ```sh
   git clone https://github.com/Xpicode/Budget-Tracker.git && cd Budget-Tracker
   cp .env.example .env
   ```
   In `.env` set a new `POSTGRES_PASSWORD`, a new `JWT_SECRET` (`openssl rand -hex 32`), and `TUNNEL_TOKEN`. Never reuse your PC's values, never commit this file.
3. **Start**: `docker compose --profile prod up -d --build`. This runs Postgres, the app (which applies migrations on start), a daily backup and the tunnel.
4. **Check**: open `https://budget.example.com/api/health`, it should show `{"ok":true}`.
5. **Install**: Android Chrome → menu → *Install app*. Windows Chrome/Edge → install icon in the address bar. iPhone Safari → Share → *Add to Home Screen*.

**Update** after a new commit: `git pull && docker compose --profile prod up -d --build`.

**Backups** land in `./backups/budget-YYYY-MM-DD.sql.gz`, one per day, kept 14 days. Copy them off the server now and then. Restore into an empty database with:
```sh
gunzip -c backups/budget-2026-11-03.sql.gz | docker compose exec -T db psql -U budget budget
```

Prefer your own domain and open ports instead of a tunnel? Put Caddy in front of `127.0.0.1:8080` (`budget.example.com { reverse_proxy 127.0.0.1:8080 }`) and leave `TUNNEL_TOKEN` empty and the `tunnel` service stopped.
