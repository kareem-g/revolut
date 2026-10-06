import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { F, Palette, R, springs, usePalette } from '../theme';
import { BoltLogo } from './BoltLogo';

// --- Splash (1.1 s, like the Android app) -----------------------------------
// Flat panel grey, a single bolt, the wordmark. No gradients — the enclosure
// is powder-coated, not glossy.

export function Splash({ palette, title, tagline }: { palette: Palette; title: string; tagline: string }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withSpring(1, springs.splash);
  }, [appear]);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.62 + 0.38 * appear.value },
      { rotate: `${-28 * (1 - appear.value)}deg` },
    ],
    opacity: appear.value,
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }]}>
      <View style={styles.splash}>
        <Animated.View style={logoStyle}>
          <BoltLogo size={120} color={palette.primary} />
        </Animated.View>
        <Animated.Text style={[styles.splashTitle, { color: palette.onSurface }, textStyle]}>
          {title}
        </Animated.Text>
        <Animated.Text style={[styles.splashTagline, { color: palette.onSurfaceVariant }, textStyle]}>
          {tagline}
        </Animated.Text>
        <View style={{ height: 38 }} />
        <ActivityIndicator size="small" color={palette.outline} />
      </View>
    </View>
  );
}

/** Splash overlay that fades out after `ms`, then unmounts itself. */
export function SplashGate({ ms, palette, title, tagline }: { ms: number } & {
  palette: Palette;
  title: string;
  tagline: string;
}) {
  const [visible, setVisible] = useState(true);
  const fade = useSharedValue(1);
  useEffect(() => {
    const t = setTimeout(() => {
      fade.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 1 + 0.06 * (1 - fade.value) }],
  }));
  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      <Splash palette={palette} title={title} tagline={tagline} />
    </Animated.View>
  );
}

// --- MessageCard / EmptyState -------------------------------------------------

export function MessageCard({
  text,
  isError,
  palette,
}: {
  text: string;
  isError: boolean;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.message,
        {
          backgroundColor: isError ? palette.errorContainer : palette.surfaceHighest,
          borderStartColor: isError ? palette.error : 'transparent',
        },
      ]}>
      <Text style={{ color: isError ? palette.onErrorContainer : palette.onSurface, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  palette,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  palette: Palette;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.surfaceHighest }]}>
        <BoltLogo size={26} color={palette.onSurfaceVariant} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.onSurface }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: palette.onSurfaceVariant }]}>{body}</Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={[styles.button, { backgroundColor: palette.primary, marginTop: 18 }]}>
          <Text style={[styles.buttonText, { color: palette.onPrimary }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// --- Form fields ------------------------------------------------------------------
// Labels are engraved captions; inputs sit in recessed white wells with a
// hairline border.

export function Field({
  label,
  hint,
  value,
  onChangeText,
  palette,
  secure = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  placeholder,
  mono = false,
  editable = true,
  style,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  palette: Palette;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'numbers-and-punctuation';
  autoCapitalize?: 'none' | 'characters' | 'sentences';
  placeholder?: string;
  mono?: boolean;
  editable?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      <Text style={[styles.fieldLabel, { color: palette.onSurfaceVariant }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={palette.outline}
        style={[
          styles.fieldInput,
          mono && styles.mono,
          {
            backgroundColor: palette.surfaceLowest,
            borderColor: palette.outlineVariant,
            color: palette.onSurface,
          },
        ]}
      />
      {hint ? (
        <Text style={[styles.fieldHint, { color: palette.onSurfaceVariant }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// --- Cards ------------------------------------------------------------------------

export function Card({
  palette,
  children,
  style,
}: {
  palette: Palette;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surfaceLow, borderColor: palette.outlineVariant },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ text, palette }: { text: string; palette: Palette }) {
  return <Text style={[styles.sectionTitle, { color: palette.onSurfaceVariant }]}>{text}</Text>;
}

export function BodyText({ text, palette }: { text: string; palette: Palette }) {
  return <Text style={[styles.body, { color: palette.onSurfaceVariant }]}>{text}</Text>;
}

// --- Segmented control -------------------------------------------------------------
// The active segment is the one "switched on": solid ink, panel-colored label.

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  palette,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.segment,
        { borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLowest },
      ]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.segmentItem,
              selected && { backgroundColor: palette.onSurface },
            ]}>
            <Text
              style={[
                styles.segmentText,
                { color: selected ? palette.background : palette.onSurfaceVariant },
              ]}
              numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Toast (Snackbar equivalent) ----------------------------------------------------

type ToastFn = (message: string) => void;
const ToastCtx = React.createContext<ToastFn>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const translateY = useSharedValue(80);
  const palette = usePalette();

  const show = useMemo<ToastFn>(
    () => (m: string) => {
      setMessage(m);
      setVisible(true);
      translateY.value = withSpring(0);
    },
    [translateY],
  );

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      translateY.value = withTiming(80, { duration: 220, easing: Easing.in(Easing.quad) });
    }, 2600);
    const t2 = setTimeout(() => setVisible(false), 2900);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [visible, message, translateY]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {visible && message && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, style, { backgroundColor: palette.onSurface }]}>
          <Text style={[styles.toastText, { color: palette.background }]}>{message}</Text>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastFn {
  return React.useContext(ToastCtx);
}

// --- styles ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashTitle: { fontFamily: F.wordmark, fontSize: 32, marginTop: 20, letterSpacing: 0.5 },
  splashTagline: { fontSize: 13, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pill: {
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pillText: { fontSize: 13, fontWeight: '500' },
  tile: {
    borderRadius: R.md,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  card: { borderRadius: R.md, padding: 18, gap: 14, borderWidth: StyleSheet.hairlineWidth },
  message: {
    borderRadius: R.sm,
    borderStartWidth: 3,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 12 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  button: {
    minHeight: 48,
    borderRadius: R.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: R.sm,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
  },
  fieldHint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  mono: { fontFamily: F.mono },
  sectionTitle: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: R.sm, overflow: 'hidden' },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '500' },
  toast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    borderRadius: R.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '88%',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  toastText: { fontSize: 14 },
});
