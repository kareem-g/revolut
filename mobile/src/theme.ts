import { useColorScheme } from 'react-native';

// Colors ported 1:1 from android/app/src/main/java/com/powerk/app/Theme.kt
export interface Palette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  surfaceLowest: string;
  surfaceLow: string;
  surfaceContainer: string;
  surfaceHigh: string;
  surfaceHighest: string;
}

export const Light: Palette = {
  primary: '#1B6B45',
  onPrimary: '#FFFFFF',
  primaryContainer: '#A6F2C4',
  onPrimaryContainer: '#00210F',
  secondary: '#4E6355',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D0E8D7',
  onSecondaryContainer: '#0B1F14',
  tertiary: '#3C6373',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  background: '#F5FBF5',
  onBackground: '#171D18',
  surface: '#F5FBF5',
  onSurface: '#171D18',
  surfaceVariant: '#DCE5DA',
  onSurfaceVariant: '#404943',
  outline: '#707972',
  outlineVariant: '#C0C9C0',
  surfaceLowest: '#FFFFFF',
  surfaceLow: '#EFF6EF',
  surfaceContainer: '#E9F0E9',
  surfaceHigh: '#E3EAE3',
  surfaceHighest: '#DDE4DD',
};

export const Dark: Palette = {
  primary: '#8AD5A7',
  onPrimary: '#00391E',
  primaryContainer: '#00522E',
  onPrimaryContainer: '#A6F2C4',
  secondary: '#B4CCB9',
  onSecondary: '#203528',
  secondaryContainer: '#364B3E',
  onSecondaryContainer: '#D0E8D7',
  tertiary: '#A4CCDF',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#0F1511',
  onBackground: '#DEE4DE',
  surface: '#0F1511',
  onSurface: '#DEE4DE',
  surfaceVariant: '#404943',
  onSurfaceVariant: '#C0C9C0',
  outline: '#8A938C',
  outlineVariant: '#404943',
  surfaceLowest: '#0A0F0B',
  surfaceLow: '#171D19',
  surfaceContainer: '#1B211C',
  surfaceHigh: '#252B26',
  surfaceHighest: '#303631',
};

export function usePalette(): Palette {
  const dark = useColorScheme() === 'dark';
  return dark ? Dark : Light;
}

// Shape radius scale from Theme.kt (small 12, medium 18, large 24, extraLarge 30)
export const R = { xs: 8, sm: 12, md: 18, lg: 24, xl: 30, full: 999 };

/** Spring presets mirroring the Compose springs (dampingRatio, stiffness). */
export const springs = {
  toggle: { damping: 15, stiffness: 170 },
  sweep: { damping: 20, stiffness: 90 },
  splash: { damping: 14, stiffness: 60 },
};
