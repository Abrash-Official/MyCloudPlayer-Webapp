# MyCloudPlayer Web

React + Vite web app that mirrors the MyCloudPlayer mobile experience:

- Continue with Google (Drive scopes)
- Sync the **MyCloudPlayer** Drive folder
- Songs & playlists (same `playlist.json` model)
- Search library + optional YouTube download → Drive
- HTML5 audio player with queue, shuffle, repeat
- Light / dark / system themes
- Responsive layout (phone + desktop sidebar)

## Setup

```bash
cd webapp
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 **Web** client ID from Google Cloud Console |
| `VITE_EXTRACT_API_URL` | Yes | Cobalt-compatible extract API (`…/api/json`) |
| `VITE_YOUTUBE_API_KEY` | No | Optional default YouTube Data API key (also settable in Settings) |
| `GOOGLE_CLIENT_ID` | Yes on Netlify | Same Web client ID (for Functions) |
| `GOOGLE_CLIENT_SECRET` | Yes on Netlify | Web client **secret** (Functions only — never `VITE_`) |
| `SESSION_SECRET` | Yes on Netlify | Random string used to encrypt the refresh cookie |

### Google Cloud Console (fixes “Access blocked” / auth errors)

You do **not** need to deploy online first. Localhost works once Google allows it.

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project that owns your client ID.
2. **APIs & Services → enable** Google Drive API (and YouTube Data API if using Search).
3. **Credentials → OAuth 2.0 Client IDs → Web client** (type *Web application*).
4. Under **Authorized JavaScript origins**, add exactly:
   - `http://localhost:5173`
   - `https://mycloudplayer.netlify.app`
5. Under **Authorized redirect URIs**, add:
   - `https://mycloudplayer.netlify.app/.netlify/functions/auth-callback`
6. If the consent screen is in **Testing**, add your Gmail under **Test users**.
7. Put the Web client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`, and put `GOOGLE_CLIENT_SECRET` + `SESSION_SECRET` in Netlify env for long sessions.

Common causes of “Access blocked”:
- Origin missing / typo (must be `http://localhost:5173`, not `127.0.0.1` unless you also add that)
- Using an Android client ID instead of a **Web** client ID
- App in Testing mode and your account is not a test user
- Redirect URI missing or placed under JavaScript origins by mistake

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

## Notes

- **Production (Netlify):** uses OAuth refresh tokens in an httpOnly cookie via Netlify Functions — sessions can last weeks without logging in again.
- **Local `npm run dev`:** uses Google Identity popup tokens (~1 hour) unless you run `netlify dev`.
- Drive audio is fetched with `Authorization: Bearer …` into a blob URL for `<audio>` (browsers cannot send custom headers on media `src`).
- Device-local music from the Android app is not available on web.
