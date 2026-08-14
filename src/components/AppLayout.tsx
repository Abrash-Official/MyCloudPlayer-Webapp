import { NavLink, Outlet } from 'react-router-dom';
import { Icons } from './Icons';
import MiniPlayer from './MiniPlayer';
import PlayerModal from './PlayerModal';
import QueueModal from './QueueModal';
import LoginPage from '../pages/LoginPage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';
import { restoreAuthSession } from '../api/auth';

export default function AppLayout() {
  const { colors, resolved } = useAppTheme();
  const currentTrack = useStore((s) => s.currentTrack);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const setAuth = useStore((s) => s.setAuth);
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (hydrated) return;
    return useStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg', colors.background);
    root.style.setProperty('--surface', colors.surface);
    root.style.setProperty('--surface-variant', colors.surfaceVariant);
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-container', colors.primaryContainer);
    root.style.setProperty('--on-primary', colors.onPrimary);
    root.style.setProperty('--text', colors.text);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-disabled', colors.textDisabled);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--error', colors.error);
    root.style.setProperty('--tab-bg', colors.tabBar);
    root.style.setProperty('--tab-border', colors.tabBarBorder);
    root.style.setProperty('--icon-inactive', colors.iconInactive);
    root.style.setProperty('--input-bg', colors.inputBackground);
    root.style.setProperty('--card-bg', colors.cardBackground);
    root.style.setProperty('--overlay', colors.overlay);
    document.body.classList.toggle('theme-light', resolved === 'light');
    document.body.classList.toggle('theme-dark', resolved === 'dark');
  }, [colors, resolved]);

  useEffect(() => {
    if (!hydrated) return;

    const { userEmail, myCloudPlayerFolderId, accessToken, isAuthenticated } =
      useStore.getState();

    if (!isAuthenticated || !userEmail || !myCloudPlayerFolderId) {
      setRestoring(false);
      return;
    }

    if (accessToken) {
      setRestoring(false);
      return;
    }

    setRestoring(true);
    void restoreAuthSession(userEmail, myCloudPlayerFolderId)
      .then((restored) => {
        if (restored) {
          setAuth(restored.userInfo, restored.accessToken, restored.folderId);
        }
      })
      .finally(() => setRestoring(false));
  }, [hydrated, setAuth]);

  if (!hydrated || restoring) {
    return (
      <div
        className="login-page"
        style={{ background: colors.background, color: colors.text }}
      >
        <div className="login-card" style={{ alignItems: 'center' }}>
          <span className="spinner" />
          <p className="login-sub">Starting MyCloudPlayer…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <header className="top-nav" aria-label="Main">
        <NavLink to="/" end className="top-nav-brand">
          <span className="top-nav-logo">
            <Icons.music size={20} />
          </span>
          <span className="top-nav-name">MyCloudPlayer</span>
        </NavLink>

        <nav className="top-nav-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `top-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icons.library size={18} />
            Library
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) => `top-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icons.search size={18} />
            Search
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `top-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icons.settings size={18} />
            Settings
          </NavLink>
        </nav>
      </header>

      <nav className="tab-bar mobile-nav" aria-label="Mobile">
        <NavLink to="/" end className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <Icons.library />
          Library
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <Icons.search />
          Search
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <Icons.settings />
          Settings
        </NavLink>
      </nav>

      <div className="app-content">
        <main className={`app-main ${currentTrack ? 'has-mini' : ''}`}>
          <Outlet />
        </main>
        <MiniPlayer />
      </div>

      <PlayerModal />
      <QueueModal />
    </div>
  );
}
