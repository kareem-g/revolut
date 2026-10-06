import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { F, METER_MAX_W, Palette, R, springs } from '../theme';
import type { Strip } from '../api';

const Spinner = ActivityIndicator;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// --- StatusDot --------------------------------------------------------------
// Panel LED convention: solid green = powered, pulsing grey = no carrier.

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
    opacity: online ? 1 : interpolate(pulse.value, [0, 1], [1, 0.3]),
  }));
  return (
    <View
      style={[
        styles.dotRing,
        { borderColor: online ? palette.live : palette.outline },
      ]}>
      <Animated.View
        style={[styles.dot, { backgroundColor: online ? palette.live : palette.outline }, style]}
      />
    </View>
  );
}

// --- Toggle -----------------------------------------------------------------
// A labelled switch built on the same animated track as the outlet tiles.

export function Toggle({
  on,
  onChange,
  palette,
  disabled = false,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  palette: Palette;
  disabled?: boolean;
}) {
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(on ? 1 : 0, springs.toggle);
  }, [on, progress]);
  return (
    <Pressable
      onPress={() => onChange(!on)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}>
      <MiniSwitch progress={progress} palette={palette} />
    </Pressable>
  );
}

// --- LoadMeter -----------------------------------------------------------------
// The signature element: a DIN energy-meter face. A big mono wattage over a
// 20-segment LED bargraph; the top 20% of the scale is the overload zone and
// lights in the alarm color. Everything about it reads "panel instrument".

const SEGMENTS = 20;
const OVERLOAD_FROM = Math.round(SEGMENTS * 0.8);

function MeterSegment({
  index,
  progress,
  online,
  palette,
}: {
  index: number;
  progress: ReturnType<typeof useSharedValue<number>>;
  online: boolean;
  palette: Palette;
}) {
  const threshold = (index + 1) / SEGMENTS;
  const litColor = index >= OVERLOAD_FROM ? palette.fault : palette.primary;
  const style = useAnimatedStyle(() => ({
    backgroundColor: online
      ? interpolateColor(
          progress.value,
          [Math.max(threshold - 0.001, 0), threshold],
          [palette.surfaceHighest, litColor],
        )
      : palette.surfaceHighest,
  }));
  return <Animated.View style={[styles.segment, style]} />;
}

export function LoadMeter({
  watts,
  online,
  palette,
  unit,
  metrics,
}: {
  watts: number;
  online: boolean;
  palette: Palette;
  unit: string;
  metrics: string[];
}) {
  const target = Math.min(Math.max(watts / METER_MAX_W, 0), 1);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(target, springs.sweep);
  }, [target, progress]);

  return (
    <View>
      <View style={styles.meterRow}>
        <Text numberOfLines={1} style={[styles.watts, { color: palette.onSurface }]}>
          {Math.round(watts)}
        </Text>
        <Text style={[styles.wattsUnit, { color: palette.onSurfaceVariant }]}>{unit}</Text>
      </View>
      <View style={styles.scale}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <MeterSegment
            key={i}
            index={i}
            progress={progress}
            online={online}
            palette={palette}
          />
        ))}
      </View>
      <View style={styles.scaleEnds}>
        <Text style={[styles.scaleTick, { color: palette.onSurfaceVariant }]}>0</Text>
        <Text style={[styles.scaleTick, { color: palette.onSurfaceVariant }]}>{METER_MAX_W}</Text>
      </View>
      <Text style={[styles.metrics, { color: palette.onSurfaceVariant }]}>
        {metrics.filter(Boolean).join('  ·  ')}
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

// --- OutletTile --------------------------------------------------------------------
// A breaker module: hairline outline, a status edge on the start side that
// energizes with the circuit, an engraved outlet label and mono readout.

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
  onOpenSchedule,
  scheduleCount,
  style,
}: {
  outlet: TileOutlet;
  on: boolean;
  pending: boolean;
  enabled: boolean;
  labels: { name: string; stateOn: string; stateOff: string; detailOn: string; detailOff: string };
  palette: Palette;
  onToggle: (next: boolean) => void;
  onOpenSchedule?: () => void;
  scheduleCount?: number;
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
      [palette.surfaceLowest, palette.primaryContainer],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.outlineVariant, palette.primary],
    ),
  }));
  const edge = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [palette.surfaceHighest, palette.primary]),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !enabled || pending }}
      disabled={!enabled || pending}
      onPress={() => onToggle(!on)}
      style={[styles.tile, container, style]}>
      <Animated.View style={[styles.edge, edge]} />
      <View style={styles.tileTopRow}>
        <Text style={[styles.tileName, { color: palette.onSurfaceVariant }]} numberOfLines={1}>
          {labels.name}
        </Text>
        {pending ? (
          <Spinner size={20} color={palette.primary} />
        ) : (
          <MiniSwitch progress={progress} palette={palette} />
        )}
      </View>
      <Text style={[styles.tileState, { color: on ? palette.onPrimaryContainer : palette.onSurface }]}>
        {on ? labels.stateOn : labels.stateOff}
      </Text>
      <View style={styles.tileBottom}>
        <Text style={[styles.tileDetail, { color: palette.onSurfaceVariant }]} numberOfLines={1}>
          {on ? labels.detailOn : labels.detailOff}
        </Text>
        {onOpenSchedule && (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="schedule"
            onPress={onOpenSchedule}
            style={styles.schedChip}>
            <Ionicons
              name="time-outline"
              size={14}
              color={on ? palette.onPrimaryContainer : palette.onSurfaceVariant}
            />
            {(scheduleCount ?? 0) > 0 && (
              <Text
                style={[
                  styles.schedCount,
                  { color: on ? palette.onPrimaryContainer : palette.onSurfaceVariant },
                ]}>
                {scheduleCount}
              </Text>
            )}
          </Pressable>
        )}
      </View>
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
  scheduleCount,
  onOpenSchedule,
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
  scheduleCount?: (outlet: number) => number;
  onOpenSchedule?: (outlet: number) => void;
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

  const metrics = [
    strip.voltage != null ? `${Math.round(strip.voltage)} V` : '',
    strip.currentA != null ? `${strip.currentA} A` : '',
    `${strip.energyKwh} kWh`,
    strip.rssi != null ? `${strip.rssi} dBm` : '',
  ];

  return (
    <View
      style={[styles.card, { backgroundColor: palette.surfaceLow, borderColor: palette.outlineVariant }]}>
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

      <View
        style={[
          styles.meterBox,
          { backgroundColor: palette.surfaceLowest, borderColor: palette.surfaceHighest },
        ]}>
        <LoadMeter
          watts={strip.powerW}
          online={strip.online}
          palette={palette}
          unit={` ${strings.unit}`}
          metrics={metrics}
        />
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
              onOpenSchedule={onOpenSchedule ? () => onOpenSchedule(o.n) : undefined}
              scheduleCount={scheduleCount?.(o.n)}
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
        ? palette.onSurface
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
      {pending && <Spinner size={18} color={fg} />}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// --- styles ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  dotRing: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 10,
  },
  watts: {
    fontFamily: F.monoSemi,
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  wattsUnit: { fontFamily: F.mono, fontSize: 14, marginBottom: 5 },
  scale: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
  },
  segment: { flex: 1, borderRadius: 1 },
  scaleEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleTick: { fontFamily: F.mono, fontSize: 10 },
  metrics: {
    fontFamily: F.mono,
    fontSize: 12,
    marginTop: 10,
    writingDirection: 'ltr',
  },
  switchTrack: { width: 38, height: 22, borderRadius: 11 },
  switchThumb: { width: 18, height: 18, borderRadius: 9, marginTop: 2 },
  tile: {
    borderRadius: R.md,
    minHeight: 104,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
    borderWidth: 1,
    overflow: 'hidden',
  },
  edge: { position: 'absolute', top: 0, bottom: 0, width: 3, start: 0 },
  tileTopRow: { flexDirection: 'row', alignItems: 'center' },
  tileName: { fontSize: 12, fontWeight: '600', flex: 1 },
  tileState: { fontSize: 16, fontWeight: '700' },
  tileDetail: { fontSize: 12, fontVariant: ['tabular-nums'], flex: 1 },
  tileBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  schedChip: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 24, paddingHorizontal: 2 },
  schedCount: { fontFamily: F.mono, fontSize: 11, fontWeight: '600' },
  card: { borderRadius: R.md, padding: 18, gap: 14, borderWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardFw: { fontSize: 12, marginTop: 1 },
  meterBox: {
    borderRadius: R.sm,
    borderWidth: 1,
    padding: 14,
  },
  tileRow: { flexDirection: 'row', gap: 10 },
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
});
