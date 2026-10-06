import { useColorScheme } from 'react-native';

// powerk design language: "service panel".
// The app is the faceplate of a small distribution board — powder-coated grey
// panel, white DIN modules with hairline outlines, engraved labels, one
// safety-orange accent for everything energized. Green is reserved for the
// online LED, red for faults. Colors were chosen from the strip's own world:
// enclosure paint (RAL 7035 territory), safety-orange warning markings, panel
// LED conventions.

export interface Palette {
  /** Interactive + energized: primary buttons, ON tiles, the load meter fill. */
  primary: string;
  onPrimary: string;
  /** Tinted wash for ON states. */
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  /** Neutral chip background (status box, tonal buttons). */
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
  /** Recessed wells: inputs, the provisioning log. */
  surfaceLowest: string;
  /** DIN modules: cards. */
  surfaceLow: string;
  surfaceContainer: string;
  surfaceHigh: string;
  /** Raised wells: metric chips. */
  surfaceHighest: string;
  /** Online LED. */
  live: string;
  /** Alarm LED. */
  fault: string;
}

export const Light: Palette = {
  primary: '#E85D04', // safety orange
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFE3CE',
  onPrimaryContainer: '#6E2A00',
  secondary: '#434A42',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E4E5DF',
  onSecondaryContainer: '#262924',
  tertiary: '#8A5A00',
  error: '#C92A2A',
  onError: '#FFFFFF',
  errorContainer: '#FBE3E0',
  onErrorContainer: '#701818',
  background: '#E9EAE4', // powder-coated panel grey
  onBackground: '#1A1D19',
  surface: '#E9EAE4',
  onSurface: '#1A1D19',
  surfaceVariant: '#D9DBD2',
  onSurfaceVariant: '#5C625A',
  outline: '#7C827A',
  outlineVariant: '#C7CAC0', // hairlines
  surfaceLowest: '#FFFFFF',
  surfaceLow: '#FBFBF8', // module faces
  surfaceContainer: '#EFF0E9',
  surfaceHigh: '#E4E5DE',
  surfaceHighest: '#DDDfd6',
  live: '#2F9E44', // panel LED green
  fault: '#C92A2A',
};

export const Dark: Palette = {
  primary: '#FF7A33',
  onPrimary: '#2A1200',
  primaryContainer: '#43200A',
  onPrimaryContainer: '#FFC29E',
  secondary: '#AEB4AB',
  onSecondary: '#1C201B',
  secondaryContainer: '#2A2E28',
  onSecondaryContainer: '#D5D9D2',
  tertiary: '#E0B25C',
  error: '#FF7B72',
  onError: '#5C1512',
  errorContainer: '#5C1A16',
  onErrorContainer: '#FFD9D4',
  background: '#121410', // graphite enclosure
  onBackground: '#E7E9E3',
  surface: '#121410',
  onSurface: '#E7E9E3',
  surfaceVariant: '#2E322B',
  onSurfaceVariant: '#9BA29A',
  outline: '#878E85',
  outlineVariant: '#333831',
  surfaceLowest: '#161913',
  surfaceLow: '#1B1E19',
  surfaceContainer: '#22261F',
  surfaceHigh: '#2A2E27',
  surfaceHighest: '#31352E',
  live: '#51CF66',
  fault: '#FF7B72',
};

export function usePalette(): Palette {
  const dark = useColorScheme() === 'dark';
  return dark ? Dark : Light;
}

// Tight, industrial radius scale — modules are machined, not bubbly.
export const R = { xs: 4, sm: 8, md: 10, lg: 14, xl: 18, full: 999 };

/**
 * Type. IBM Plex Mono carries every number (panel-meter face, tabular digits);
 * Archivo Black is the wordmark/ signage voice. Both are Latin-only — Arabic
 * copy stays in the system face (SF Arabic), which handles shaping and RTL.
 */
export const F = {
  wordmark: 'ArchivoBlack_400Regular',
  mono: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
} as const;

/** The font families passed to useFonts() at boot. */
export const FONTS = {
  ArchivoBlack_400Regular: require('@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf'),
  IBMPlexMono_500Medium: require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'),
  IBMPlexMono_600SemiBold: require('@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf'),
};

/** Load scale for the meter: the strip's rated ceiling, in watts. */
export const METER_MAX_W = 2000;

/** Spring presets (dampingRatio, stiffness). Sheet ≈ Apple's ζ0.8 / response 0.3. */
export const springs = {
  toggle: { damping: 15, stiffness: 170 },
  sweep: { damping: 20, stiffness: 90 },
  splash: { damping: 14, stiffness: 60 },
  sheet: { damping: 34, stiffness: 440 },
};
