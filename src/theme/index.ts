import type { ThemeMode } from '../types';

export type { ThemeMode };

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  text: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  error: string;
  success: string;
  playerBackground: string;
  tabBar: string;
  tabBarBorder: string;
  icon: string;
  iconInactive: string;
  inputBackground: string;
  cardBackground: string;
  overlay: string;
}

const ACCENT = '#4FD1C5';
const DARK_BG = '#1a202c';
const DARK_SURFACE = '#2d3748';

const darkColors: ThemeColors = {
  background: DARK_BG,
  surface: DARK_SURFACE,
  surfaceVariant: '#374151',
  primary: ACCENT,
  primaryContainer: '#234e52',
  onPrimary: DARK_BG,
  text: '#F7FAFC',
  textSecondary: '#A0AEC0',
  textDisabled: '#718096',
  border: '#4A5568',
  error: '#FC8181',
  success: ACCENT,
  playerBackground: DARK_BG,
  tabBar: DARK_SURFACE,
  tabBarBorder: '#4A5568',
  icon: '#F7FAFC',
  iconInactive: '#718096',
  inputBackground: '#374151',
  cardBackground: DARK_SURFACE,
  overlay: 'rgba(26, 32, 44, 0.85)',
};

const lightColors: ThemeColors = {
  background: '#ffffff',
  surface: '#ffffff',
  surfaceVariant: '#F7FAFC',
  primary: ACCENT,
  primaryContainer: '#E6FFFA',
  onPrimary: '#000000',
  text: '#000000',
  textSecondary: '#4A5568',
  textDisabled: '#A0AEC0',
  border: '#E2E8F0',
  error: '#E53E3E',
  success: '#38A169',
  playerBackground: '#ffffff',
  tabBar: '#ffffff',
  tabBarBorder: '#E2E8F0',
  icon: '#000000',
  iconInactive: '#A0AEC0',
  inputBackground: '#F7FAFC',
  cardBackground: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

export const getThemeColors = (theme: 'light' | 'dark'): ThemeColors =>
  theme === 'dark' ? darkColors : lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: 700 as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: 700 as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: 600 as const },
  body: { fontSize: 15, fontWeight: 400 as const },
  bodyMedium: { fontSize: 15, fontWeight: 500 as const },
  caption: { fontSize: 12, fontWeight: 400 as const },
  captionMedium: { fontSize: 12, fontWeight: 500 as const },
  label: { fontSize: 13, fontWeight: 500 as const },
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
