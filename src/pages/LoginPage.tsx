import { useState } from 'react';
import { Icons } from '../components/Icons';
import { signIn } from '../api/auth';
import { useStore } from '../store/useStore';
import { useAppTheme } from '../hooks/useAppTheme';

export default function LoginPage() {
  const setAuth = useStore((s) => s.setAuth);
  const { colors } = useAppTheme();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const result = await signIn();
      setAuth(result.userInfo, result.accessToken, result.folderId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      if (!/cancel/i.test(message)) {
        setError(message);
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{
        background: `linear-gradient(160deg, ${colors.primaryContainer} 0%, ${colors.background} 45%, ${colors.background} 100%)`,
        color: colors.text,
      }}
    >
      <div className="login-card">
        <div className="login-logo" style={{ background: colors.primaryContainer }}>
          <Icons.music size={40} />
        </div>
        <h1>MyCloudPlayer</h1>
        <p className="login-sub">
          Your Google Drive music library — playlists, search, and streaming in the
          browser.
        </p>

        <button
          type="button"
          className="btn login-google-btn"
          disabled={connecting}
          onClick={() => void handleConnect()}
        >
          {connecting ? (
            <span className="spinner" />
          ) : (
            <Icons.albums size={18} />
          )}
          Continue with Google
        </button>

        {error ? (
          <div className="login-error" role="alert">
            <strong>Sign-in blocked</strong>
            <p>{error}</p>
            <p className="login-hint">
              In Google Cloud Console → Credentials → your <em>Web</em> OAuth client,
              add Authorized JavaScript origin:
              <br />
              <code>http://localhost:5173</code>
              <br />
              Also ensure the OAuth consent screen includes your Google account as a
              test user (if the app is in Testing mode).
            </p>
          </div>
        ) : (
          <p className="login-hint">
            Works on localhost once <code>http://localhost:5173</code> is listed as an
            authorized JavaScript origin. You do not need to deploy first.
          </p>
        )}
      </div>
    </div>
  );
}
