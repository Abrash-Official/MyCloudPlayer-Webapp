import { useState } from 'react';
import { Icons } from '../components/Icons';
import { signIn, useNetlifyAuth } from '../api/auth';
import { useStore } from '../store/useStore';
import { useAppTheme } from '../hooks/useAppTheme';

type LoginPageProps = {
  initialError?: string | null;
};

export default function LoginPage({ initialError = null }: LoginPageProps) {
  const setAuth = useStore((s) => s.setAuth);
  const { colors } = useAppTheme();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const netlify = useNetlifyAuth();

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const result = await signIn();
      // Netlify path redirects away; GIS path returns a result
      if (result?.userInfo) {
        setAuth(result.userInfo, result.accessToken, result.folderId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      if (!/cancel/i.test(message)) {
        setError(message);
      }
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
              Check Google Cloud → your Web OAuth client:
              <br />
              Origins: <code>https://mycloudplayer.netlify.app</code>
              <br />
              Redirect URI:{' '}
              <code>
                https://mycloudplayer.netlify.app/.netlify/functions/auth-callback
              </code>
            </p>
          </div>
        ) : (
          <p className="login-hint">
            {netlify
              ? 'Long-session sign-in via Netlify. You should stay signed in for weeks without logging in again.'
              : 'Local mode uses Google popup tokens (~1 hour). Deploy to Netlify for long sessions.'}
          </p>
        )}
      </div>
    </div>
  );
}
