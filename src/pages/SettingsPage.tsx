import { useState } from 'react';
import { Icons } from '../components/Icons';
import { signIn, signOut } from '../api/auth';
import { useStore } from '../store/useStore';
import type { ThemeMode } from '../types';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: 'monitor' | 'sun' | 'moon' }[] = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsPage() {
  const {
    theme,
    setTheme,
    youtubeApiKey,
    setYoutubeApiKey,
    userName,
    userEmail,
    userPhoto,
    isAuthenticated,
    setAuth,
    clearAuth,
  } = useStore();

  const [localYtKey, setLocalYtKey] = useState(youtubeApiKey);
  const [ytVisible, setYtVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const result = await signIn();
      setAuth(result.userInfo, result.accessToken, result.folderId);
      window.alert('Google Drive connected. Open Library and refresh to sync.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      if (!/cancel/i.test(message)) window.alert(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Cloud songs will be hidden until you sign in again.')) {
      return;
    }
    try {
      await signOut();
    } catch {
      /* ignore */
    } finally {
      clearAuth();
    }
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Settings</h1>
          <p className="sub">Account, theme & API keys</p>
        </div>
      </header>

      <section className="card">
        <h3>Google Drive</h3>
        {isAuthenticated ? (
          <>
            <div className="profile" style={{ marginBottom: 16 }}>
              <div className="avatar">
                {userPhoto ? (
                  <img src={userPhoto} alt="" />
                ) : (
                  (userName ?? 'U').slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <div className="song-title">{userName}</div>
                <div className="song-sub">{userEmail}</div>
              </div>
            </div>
            <button type="button" className="btn danger" onClick={() => void handleDisconnect()}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p className="song-sub" style={{ marginBottom: 12 }}>
              Continue with Google to sync your MyCloudPlayer folder, playlists, and uploads.
            </p>
            <button
              type="button"
              className="btn"
              disabled={connecting}
              onClick={() => void handleConnect()}
            >
              {connecting ? <span className="spinner" /> : <Icons.albums size={18} />}
              Continue with Google
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h3>Theme</h3>
        <div className="theme-row">
          {THEME_OPTIONS.map((opt) => {
            const Icon =
              opt.icon === 'sun'
                ? Icons.sun
                : opt.icon === 'moon'
                  ? Icons.moon
                  : Icons.monitor;
            return (
              <button
                key={opt.value}
                type="button"
                className={`theme-opt ${theme === opt.value ? 'active' : ''}`}
                onClick={() => setTheme(opt.value)}
              >
                <Icon size={18} />
                <div style={{ marginTop: 6 }}>{opt.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>YouTube API key</h3>
        <p className="song-sub" style={{ marginBottom: 12 }}>
          Optional. Used only for Search → YouTube (1 result per query). Bring your own key.
        </p>
        <div className="field">
          <label htmlFor="yt-key">API key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="yt-key"
              type={ytVisible ? 'text' : 'password'}
              value={localYtKey}
              onChange={(e) => setLocalYtKey(e.target.value)}
              placeholder="AIza…"
            />
            <button
              type="button"
              className="btn secondary"
              onClick={() => setYtVisible((v) => !v)}
            >
              {ytVisible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setYoutubeApiKey(localYtKey.trim());
            window.alert('YouTube API key saved.');
          }}
        >
          Save key
        </button>
      </section>

      <section className="card">
        <h3>About</h3>
        <p className="song-sub">
          MyCloudPlayer Web — same Google Drive library, playlists, and themes as the mobile app.
          Audio streams from your Drive with your Google account.
        </p>
      </section>
    </div>
  );
}
