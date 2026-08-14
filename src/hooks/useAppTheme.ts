import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { getThemeColors, type ThemeColors } from '../theme';

export function useAppTheme(): {
  colors: ThemeColors;
  resolved: 'light' | 'dark';
} {
  const theme = useStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  return useMemo(
    () => ({ colors: getThemeColors(resolved), resolved }),
    [resolved]
  );
}
