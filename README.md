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

### Google Cloud Console (fixes “Access blocked” / auth errors)

You do **not** need to deploy online first. Localhost works once Google allows it.

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project that owns your client ID.
2. **APIs & Services → enable** Google Drive API (and YouTube Data API if using Search).
3. **Credentials → OAuth 2.0 Client IDs → Web client** (type *Web application*).
4. Under **Authorized JavaScript origins**, add exactly:
   - `http://localhost:5173`
   - later: `https://your-domain.com`
5. If the consent screen is in **Testing**, add your Gmail under **Test users**.
6. Put that Web client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`.

Common causes of “Access blocked”:
- Origin missing / typo (must be `http://localhost:5173`, not `127.0.0.1` unless you also add that)
- Using an Android client ID instead of a **Web** client ID
- App in Testing mode and your account is not a test user

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

## Notes

- Access tokens are kept in memory (not persisted). On reload, the app silently re-requests a token if the browser still has consent.
- Drive audio is fetched with `Authorization: Bearer …` into a blob URL for `<audio>` (browsers cannot send custom headers on media `src`).
- Device-local music from the Android app is not available on web.
