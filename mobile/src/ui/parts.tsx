import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Palette, springs } from '../theme';
import type { Strip } from '../api';

const Spinner = ActivityIndicator;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// --- StatusDot --------------------------------------------------------------

export function StatusDot({ online, palette }: { online: boolean; palette: Palette }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: online ? 1 : interpolate(pulse.value, [0, 1], [0.35, 1]),
  }));
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: online ? palette.primary : palette.error },
        style,
      ]}
    />
  );
}

// --- MetricPill ---------------------------------------------------------------

export function MetricPill({ value, palette }: { value: string; palette: Palette }) {
  return (
    <View style={[styles.pill, { backgroundColor: palette.surfaceHighest }]}>
      <Text
        numberOfLines={1}
        style={[styles.pillText, { color: palette.onSurfaceVariant, writingDirection: 'ltr' }]}>
        {value}
      </Text>
    </View>
  );
}

// --- MiniSwitch ----------------------------------------------------------------

function MiniSwitch({
  progress,
  palette,
}: {
  progress: ReturnType<typeof useSharedValue<number>>;
  palette: Palette;
}) {
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.outlineVariant, palette.primary],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 2 + 16 * progress.value }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.surfaceLowest, palette.onPrimary],
    ),
  }));
  return (
    <Animated.View style={[styles.switchTrack, trackStyle]}>
      <Animated.View style={[styles.switchThumb, thumbStyle]} />
    </Animated.View>
  );
}

// --- PowerRing -------------------------------------------------------------------

const RING = 142;
const STROKE = 12;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function PowerRing({
  watts,
  enabled,
  palette,
  unit = ' W',
  nowLabel = 'now',
}: {
  watts: number;
  enabled: boolean;
  palette: Palette;
  unit?: string;
  nowLabel?: string;
}) {
  const target = Math.min(Math.max(watts / 2000, 0), 1);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(target, springs.sweep);
  }, [target, progress]);

  const arcColor =
    enabled && watts > 0.05 ? palette.primary : palette.outlineVariant;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - 0.75 * progress.value),
  }));

  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={palette.surfaceHighest}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(135 ${RING / 2} ${RING / 2})`}
          strokeDasharray={`${C} ${C}`}
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={arcColor}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(135 ${RING / 2} ${RING / 2})`}
          strokeDasharray={`${C} ${C}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ width: 92, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text
            numberOfLines={1}
            style={[
              styles.watts,
              { color: palette.onSurface, fontVariant: ['tabular-nums'] },
            ]}>
            {Math.round(watts)}
          </Text>
          <Text
            style={[
              styles.wattsUnit,
              { color: palette.onSurfaceVariant, marginBottom: 6 },
            ]}>
            {unit}
          </Text>
        </View>
        <Text style={[styles.wattsNow, { color: palette.onSurfaceVariant }]}>{nowLabel}</Text>
      </View>
    </View>
  );
}

// --- OutletTile --------------------------------------------------------------------

export interface TileOutlet {
  n: number;
  on: boolean;
  powerW: number;
  tempC: number;
}

export function OutletTile({
  outlet,
  on,
  pending,
  enabled,
  labels,
  palette,
  onToggle,
  style,
}: {
  outlet: TileOutlet;
  on: boolean;
  pending: boolean;
  enabled: boolean;
  labels: { name: string; stateOn: string; stateOff: string; detailOn: string; detailOff: string };
  palette: Palette;
  onToggle: (next: boolean) => void;
  style?: ViewStyle;
}) {
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(on ? 1 : 0, springs.toggle);
  }, [on, progress]);

  const container = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.surfaceHighest, palette.primaryContainer],
    ),
    transform: [{ scale: 1 + 0.015 * progress.value }],
  }));
  const content = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 1], [palette.onSurface, palette.onPrimaryContainer]),
  );
  const titleStyle = useAnimatedStyle(() => ({ color: content.value }));
  const detailStyle = useAnimatedStyle(() => ({
    color: content.value,
    opacity: 0.8,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !enabled || pending }}
      disabled={!enabled || pending}
      onPress={() => onToggle(!on)}
      style={[styles.tile, container, style]}>
      <View style={styles.tileTopRow}>
        <Animated.Text style={[styles.tileName, titleStyle]} numberOfLines={1}>
          {labels.name}
        </Animated.Text>
        {pending ? (
          <Spinner size={22} color={palette.primary} />
        ) : (
          <MiniSwitch progress={progress} palette={palette} />
        )}
      </View>
      <Animated.Text style={[styles.tileState, titleStyle]}>
        {on ? labels.stateOn : labels.stateOff}
      </Animated.Text>
      <Animated.Text style={[styles.tileDetail, detailStyle]} numberOfLines={1}>
        {on ? labels.detailOn : labels.detailOff}
      </Animated.Text>
    </AnimatedPressable>
  );
}


// --- StripCard ------------------------------------------------------------------------

export function StripCard({
  strip,
  showMac,
  pending,
  strings,
  palette,
  onCommand,
  onRenameStrip,
}: {
  strip: Strip;
  showMac: boolean;
  pending: Record<string, boolean>;
  strings: {
    name: string;
    fw: (fw: string) => string;
    outlet: (n: number) => string;
    on: string;
    off: string;
    onDetail: (w: string, t: number) => string;
    offDetail: (t: number) => string;
    allOn: string;
    allOff: string;
    wattsNow: string;
    unit: string;
  };
  palette: Palette;
  onCommand: (mac: string, outlet: number, on: boolean) => void;
  onRenameStrip?: () => void;
}) {
  const stateOf = (n: number) => pending[`${strip.mac}:${n}`] ?? strip.outlets.find((o) => o.n === n)?.on ?? false;
  const isPending = (n: number) => pending[`${strip.mac}:${n}`] !== undefined;
  const anyOn = [1, 2, 3, 4].some(stateOf);
  const allPending = [1, 2, 3, 4].some(isPending);

  const tiles = useMemo(() => {
    const rows: TileOutlet[][] = [];
    for (let row = 0; row < 2; row++) {
      rows.push([0, 1].map((col) => strip.outlets[row * 2 + col]).filter(Boolean) as TileOutlet[]);
    }
    return rows;
  }, [strip.outlets]);

  return (
    <View style={[styles.card, { backgroundColor: palette.surfaceLow }]}>
      <View style={styles.cardHead}>
        <StatusDot online={strip.online} palette={palette} />
        <View style={{ flex: 1, marginStart: 10 }}>
          {onRenameStrip ? (
            <Pressable onPress={onRenameStrip} hitSlop={8}>
              <Text style={[styles.cardTitle, { color: palette.onSurface }]} numberOfLines={1}>
                {strings.name}
                {showMac ? ` · ${strip.mac.slice(-7)}` : ''}
                {'  ✎'}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.cardTitle, { color: palette.onSurface }]} numberOfLines={1}>
              {strings.name}
              {showMac ? ` · ${strip.mac.slice(-7)}` : ''}
            </Text>
          )}
          <Text style={[styles.cardFw, { color: palette.onSurfaceVariant }]}>{strings.fw(strip.fw)}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <PowerRing
          watts={strip.powerW}
          enabled={strip.online}
          palette={palette}
          unit={` ${strings.unit}`}
          nowLabel={strings.wattsNow}
        />
        <View style={{ gap: 8 }}>
          <MetricPill value={`${strip.energyKwh} kWh`} palette={palette} />
          {strip.voltage != null && (
            <MetricPill value={`${Math.round(strip.voltage)} V`} palette={palette} />
          )}
          {strip.currentA != null && (
            <MetricPill value={`${strip.currentA} A`} palette={palette} />
          )}
          {strip.rssi != null && <MetricPill value={`${strip.rssi} dBm`} palette={palette} />}
        </View>
      </View>

      {tiles.map((row, i) => (
        <View key={i} style={styles.tileRow}>
          {row.map((o) => (
            <OutletTile
              key={o.n}
              outlet={o}
              on={stateOf(o.n)}
              pending={isPending(o.n)}
              enabled={strip.online && !isPending(o.n)}
              palette={palette}
              labels={{
                name: strings.outlet(o.n),
                stateOn: strings.on,
                stateOff: strings.off,
                detailOn: strings.onDetail(String(o.powerW), o.tempC),
                detailOff: strings.offDetail(o.tempC),
              }}
              onToggle={(next) => onCommand(strip.mac, o.n, next)}
              style={{ flex: 1 }}
            />
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}

      <TonalButton
        label={anyOn ? strings.allOff : strings.allOn}
        pending={allPending}
        enabled={strip.online && !allPending}
        palette={palette}
        onPress={() => onCommand(strip.mac, 0, !anyOn)}
      />
    </View>
  );
}

// --- TonalButton --------------------------------------------------------------------------

export function TonalButton({
  label,
  onPress,
  enabled = true,
  pending = false,
  palette,
  variant = 'tonal',
  style,
}: {
  label: string;
  onPress: () => void;
  enabled?: boolean;
  pending?: boolean;
  palette: Palette;
  variant?: 'tonal' | 'filled' | 'outlined';
  style?: ViewStyle;
}) {
  const bg =
    variant === 'filled'
      ? palette.primary
      : variant === 'outlined'
        ? 'transparent'
        : palette.secondaryContainer;
  const fg =
    variant === 'filled'
      ? palette.onPrimary
      : variant === 'outlined'
        ? palette.primary
        : palette.onSecondaryContainer;
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled || pending}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: !enabled ? 0.38 : pressed ? 0.85 : 1 },
        variant === 'outlined' && { borderWidth: 1, borderColor: palette.outline },
        style,
      ]}>
      {pending && <Spinner size={20} color={fg} />}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// --- styles ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  dot: { width: 11, height: 11, borderRadius: 6 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pillText: { fontSize: 13, fontWeight: '500' },
  switchTrack: { width: 38, height: 22, borderRadius: 11 },
  switchThumb: { width: 18, height: 18, borderRadius: 9, marginTop: 2 },
  watts: { fontSize: 34, fontWeight: '600', lineHeight: 40 },
  wattsUnit: { fontSize: 13, fontWeight: '500' },
  wattsNow: { fontSize: 12, marginTop: 2 },
  tile: {
    borderRadius: 24,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  tileTopRow: { flexDirection: 'row', alignItems: 'center' },
  tileName: { fontSize: 13, fontWeight: '600', flex: 1 },
  tileState: { fontSize: 17, fontWeight: '700' },
  tileDetail: { fontSize: 11 },
  card: { borderRadius: 24, padding: 18, gap: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 20, fontWeight: '600' },
  cardFw: { fontSize: 12, marginTop: 1 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tileRow: { flexDirection: 'row', gap: 10 },
  button: {
    minHeight: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
