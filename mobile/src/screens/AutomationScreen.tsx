import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n';
import { F, R, usePalette } from '../theme';
import { useConn } from '../server';
import { usePowerk } from '../usePowerk';
import { useSchedules } from '../useSchedules';
import { useNames } from '../useNames';
import { OutletSchedule, makeSchedule } from '../schedule-logic';
import { startScheduleEngine, pauseScheduleEngine } from '../schedules';
import {
  Schedule,
  VoltageRule,
  addSchedule,
  addVoltageRule,
  delSchedule,
  delVoltageRule,
  schedules as fetchSchedules,
  voltageRules,
} from '../api';
import { TonalButton, Toggle } from '../ui/parts';
import { StatusDot } from '../ui/parts';
import { Wheel } from '../ui/Wheel';

// Automation: schedules per strip, per outlet. A list, not a form wall —
// each outlet is one row; expanding it shows that outlet's events and the
// wheel picker for the next one. Direct mode executes locally; server mode
// delegates to powerk.py.

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const DAY_LETTERS: Record<'en' | 'ar', string[]> = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], // index 0 = Sunday
  ar: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
};

function daysLabel(
  days: number[],
  labels: { all: string; weekdays: string; weekend: string },
  letters: string[],
): string {
  if (days.length === 0 || days.length === 7) return labels.all;
  const week = [1, 2, 3, 4, 5];
  if (week.every((d) => days.includes(d))) return labels.weekdays;
  if (days.length === 2 && days.includes(0) && days.includes(6)) return labels.weekend;
  return [...days].sort().map((d) => letters[d]).join(' ');
}

export function AutomationScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const { snapshot, command } = usePowerk();
  const { schedules, save, hydrate } = useSchedules();
  const { stripName: displayStripName, outletName: displayOutletName } = useNames();
  const route = useRoute();
  const params = route.params as { mac?: string; outlet?: number } | undefined;
  const [open, setOpen] = useState<string | null>(
    params?.mac && params?.outlet ? `${params.mac}:${params.outlet}` : null,
  );

  // tile badges on Plugs deep-link here with (mac, outlet) — follow re-navigation
  useEffect(() => {
    if (params?.mac && params?.outlet) setOpen(`${params.mac}:${params.outlet}`);
  }, [params?.mac, params?.outlet]);
  const [rules, setRules] = useState<VoltageRule[]>([]);
  const letters = DAY_LETTERS[lang === 'ar' ? 'ar' : 'en'];

  const reload = useCallback(async () => {
    if (direct || !conn.configured) return;
    try {
      const list = await fetchSchedules(conn.base, conn.token);
      hydrate(list.map((s: Schedule) => ({ ...s, enabled: true })));
      setRules(await voltageRules(conn.base, conn.token));
    } catch {
      /* offline */
    }
  }, [direct, conn, hydrate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // direct mode: schedules fire locally through the normal command path.
  // server mode: powerk.py executes them; the app engine stays paused.
  useEffect(() => {
    if (direct) startScheduleEngine(command);
    else pauseScheduleEngine();
  });

  const strips = snapshot?.strips ?? [];
  const countFor = (mac: string, outlet: number) =>
    schedules.filter((s) => s.enabled && s.mac === mac && s.outlet === outlet).length;

  const commit = (list: OutletSchedule[]) => {
    save(list);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const dayLabels = {
    all: t('days_all'),
    weekdays: t('days_weekdays'),
    weekend: t('days_weekend'),
  };

  const addServer = async (s: Omit<Schedule, 'id'>) => {
    await addSchedule(conn.base, conn.token, s);
    await reload();
  };
  const delServer = async (id: string) => {
    await delSchedule(conn.base, conn.token, id);
    await reload();
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 6 }]}>
      <Text style={[styles.title, { color: palette.onSurface }]}>{t('automation')}</Text>

      {strips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.onSurface }]}>{t('no_strip_title')}</Text>
          <Text style={[styles.emptyBody, { color: palette.onSurfaceVariant }]}>
            {t('no_strip_body')}
          </Text>
        </View>
      ) : (
        strips.map((strip) => {
          const stripEvents = schedules.filter((s) => s.mac === strip.mac);
          return (
            <View key={strip.mac} style={styles.stripBlock}>
              <View style={styles.stripHead}>
                <StatusDot online={strip.online} palette={palette} />
                <Text style={[styles.stripName, { color: palette.onSurface }]} numberOfLines={1}>
                  {displayStripName(strip.mac, strip.name)}
                </Text>
                {stripEvents.length > 0 && (
                  <Text style={[styles.stripCount, { color: palette.onSurfaceVariant }]}>
                    {stripEvents.length}
                  </Text>
                )}
              </View>
              {strip.outlets.map((o) => {
                const key = `${strip.mac}:${o.n}`;
                const expanded = open === key;
                const outletEvents = schedules
                  .filter((s) => s.mac === strip.mac && s.outlet === o.n)
                  .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
                return (
                  <View
                    key={o.n}
                    style={[
                      styles.outletBlock,
                      { borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow },
                    ]}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => undefined);
                        setOpen(expanded ? null : key);
                      }}
                      style={styles.outletRow}>
                      <Text
                        style={[styles.outletName, { color: palette.onSurface }]}
                        numberOfLines={1}>
                        {displayOutletName(strip.mac, o.n, o.name || t('outlet_n', o.n))}
                      </Text>
                      <View style={styles.outletMeta}>
                        {countFor(strip.mac, o.n) > 0 && (
                          <View
                            style={[styles.badge, { backgroundColor: palette.primaryContainer }]}>
                            <Text
                              style={[styles.badgeText, { color: palette.onPrimaryContainer }]}>
                              {countFor(strip.mac, o.n)}
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={palette.onSurfaceVariant}
                        />
                      </View>
                    </Pressable>

                    {expanded && (
                      <View style={styles.expanded}>
                        {outletEvents.length === 0 ? (
                          <Text style={[styles.noEvents, { color: palette.onSurfaceVariant }]}>
                            {t('schedule_empty')}
                          </Text>
                        ) : (
                          outletEvents.map((s) => (
                            <View
                              key={s.id}
                              style={[styles.eventRow, { borderBottomColor: palette.outlineVariant }]}>
                              <Text style={[styles.eventTime, { color: palette.onSurface }]}>
                                {s.time}
                              </Text>
                              <View style={styles.eventMeta}>
                                <Text
                                  style={[
                                    styles.eventAction,
                                    { color: s.on ? palette.primary : palette.onSurface },
                                  ]}>
                                  {s.on ? t('schedule_on') : t('schedule_off')}
                                </Text>
                                <Text
                                  style={[styles.eventDays, { color: palette.onSurfaceVariant }]}>
                                  {daysLabel(s.days, dayLabels, letters)}
                                </Text>
                              </View>
                              {direct && (
                                <Toggle
                                  on={s.enabled}
                                  onChange={(v) =>
                                    commit(
                                      schedules.map((x) =>
                                        x.id === s.id ? { ...x, enabled: v } : x,
                                      ),
                                    )
                                  }
                                  palette={palette}
                                />
                              )}
                              <Pressable
                                hitSlop={8}
                                accessibilityLabel={t('delete')}
                                onPress={() => {
                                  if (direct) commit(schedules.filter((x) => x.id !== s.id));
                                  else void delServer(s.id);
                                }}
                                style={styles.deleteBtn}>
                                <Ionicons
                                  name="trash-outline"
                                  size={17}
                                  color={palette.onSurfaceVariant}
                                />
                              </Pressable>
                            </View>
                          ))
                        )}
                        <EventForm
                          letters={letters}
                          onAdd={(s) => {
                            if (direct) commit([...schedules, s]);
                            else
                              void addServer({
                                mac: s.mac,
                                outlet: s.outlet,
                                on: s.on,
                                time: s.time,
                                days: s.days,
                              });
                            Haptics.notificationAsync(
                              Haptics.NotificationFeedbackType.Success,
                            ).catch(() => undefined);
                          }}
                          palette={palette}
                          mac={strip.mac}
                          outlet={o.n}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })
      )}

      <Text style={[styles.hint, { color: palette.onSurfaceVariant }]}>{t('schedule_hint')}</Text>
      <RuleSection
        rules={rules}
        mac={strips[0]?.mac ?? ''}
        strips={strips}
        onChanged={() => void reload()}
      />
    </ScrollView>
  );
}

function EventForm({
  mac,
  outlet,
  letters,
  onAdd,
  palette,
}: {
  mac: string;
  outlet: number;
  letters: string[];
  onAdd: (s: OutletSchedule) => void;
  palette: ReturnType<typeof usePalette>;
}) {
  const { t } = useI18n();
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0); // index into MINUTES (5-min steps)
  const [actionOn, setActionOn] = useState(true);
  const [days, setDays] = useState<number[]>([]);

  return (
    <View
      style={[styles.form, { backgroundColor: palette.surfaceLowest, borderColor: palette.outlineVariant }]}>
      <View style={styles.wheelRow}>
        <Wheel items={HOURS} index={hour} onChange={setHour} palette={palette} width={76} />
        <Text style={[styles.colon, { color: palette.onSurface }]}>:</Text>
        <Wheel items={MINUTES} index={minute} onChange={setMinute} palette={palette} width={76} />
      </View>
      <View style={styles.actionSeg}>
        <Pressable
          onPress={() => {
            setActionOn(true);
            Haptics.selectionAsync().catch(() => undefined);
          }}
          style={[
            styles.actionChip,
            { borderColor: palette.outlineVariant },
            actionOn && { backgroundColor: palette.primary, borderColor: palette.primary },
          ]}>
          <Text
            style={[
              styles.actionChipText,
              { color: actionOn ? palette.onPrimary : palette.onSurfaceVariant },
            ]}>
            {t('schedule_on')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setActionOn(false);
            Haptics.selectionAsync().catch(() => undefined);
          }}
          style={[
            styles.actionChip,
            { borderColor: palette.outlineVariant },
            !actionOn && { backgroundColor: palette.onSurface, borderColor: palette.onSurface },
          ]}>
          <Text
            style={[
              styles.actionChipText,
              { color: !actionOn ? palette.background : palette.onSurfaceVariant },
            ]}>
            {t('schedule_off')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.dayRow}>
        {letters.map((letter, d) => {
          const selected = days.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                setDays((prev) =>
                  prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
                );
              }}
              style={[
                styles.dayChip,
                { borderColor: palette.outlineVariant },
                selected && { backgroundColor: palette.onSurface, borderColor: palette.onSurface },
              ]}>
              <Text
                style={[
                  styles.dayChipText,
                  { color: selected ? palette.background : palette.onSurfaceVariant },
                ]}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TonalButton
        label={t('schedule_add')}
        variant="filled"
        palette={palette}
        onPress={() =>
          onAdd(
            makeSchedule({
              mac,
              outlet,
              on: actionOn,
              time: `${HOURS[hour]}:${MINUTES[minute]}`,
              days: [...days].sort(),
            }),
          )
        }
      />
    </View>
  );
}

function RuleSection({
  rules,
  mac,
  strips,
  onChanged,
}: {
  rules: VoltageRule[];
  mac: string;
  strips: { mac: string; name: string }[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState('below');
  const [volts, setVolts] = useState('210');
  const [action, setAction] = useState('off');

  if (direct) return null; // voltage rules run on the server

  return (
    <View style={styles.rulesBlock}>
      <Pressable style={styles.rulesHead} onPress={() => setOpen(!open)}>
        <Text style={[styles.rulesTitle, { color: palette.onSurface }]}>{t('voltage_rules')}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={palette.onSurfaceVariant}
        />
      </Pressable>
      {rules.map((r) => (
        <View key={r.id} style={[styles.eventRow, { borderBottomColor: palette.outlineVariant }]}>
          <View style={styles.eventMeta}>
            <Text style={[styles.eventAction, { color: palette.onSurface }]}>
              {r.outlet === 0 ? t('all_outlets') : t('outlet_n', r.outlet)}
            </Text>
            <Text style={[styles.eventDays, { color: palette.onSurfaceVariant }]}>
              {t(`op_${r.op}` as never)} {r.volts} V → {t(r.action === 'on' ? 'action_on' : 'action_off')}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            accessibilityLabel={t('delete')}
            onPress={() => void delVoltageRule(conn.base, conn.token, r.id).then(onChanged)}
            style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={17} color={palette.onSurfaceVariant} />
          </Pressable>
        </View>
      ))}
      {open && (
        <View
          style={[
            styles.form,
            { backgroundColor: palette.surfaceLowest, borderColor: palette.outlineVariant },
          ]}>
          <View style={styles.actionSeg}>
            <Pressable
              onPress={() => setOp('below')}
              style={[
                styles.actionChip,
                { borderColor: palette.outlineVariant },
                op === 'below' && { backgroundColor: palette.onSurface, borderColor: palette.onSurface },
              ]}>
              <Text
                style={[
                  styles.actionChipText,
                  { color: op === 'below' ? palette.background : palette.onSurfaceVariant },
                ]}>
                {t('op_below')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOp('above')}
              style={[
                styles.actionChip,
                { borderColor: palette.outlineVariant },
                op === 'above' && { backgroundColor: palette.onSurface, borderColor: palette.onSurface },
              ]}>
              <Text
                style={[
                  styles.actionChipText,
                  { color: op === 'above' ? palette.background : palette.onSurfaceVariant },
                ]}>
                {t('op_above')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.actionSeg}>
            <Pressable
              onPress={() => setAction('off')}
              style={[
                styles.actionChip,
                { borderColor: palette.outlineVariant },
                action === 'off' && { backgroundColor: palette.primary, borderColor: palette.primary },
              ]}>
              <Text
                style={[
                  styles.actionChipText,
                  { color: action === 'off' ? palette.onPrimary : palette.onSurfaceVariant },
                ]}>
                {t('action_off')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAction('on')}
              style={[
                styles.actionChip,
                { borderColor: palette.outlineVariant },
                action === 'on' && { backgroundColor: palette.primary, borderColor: palette.primary },
              ]}>
              <Text
                style={[
                  styles.actionChipText,
                  { color: action === 'on' ? palette.onPrimary : palette.onSurfaceVariant },
                ]}>
                {t('action_on')}
              </Text>
            </Pressable>
          </View>
          <TonalButton
            label={`${t('add_voltage_rule')} · ${volts} V`}
            variant="filled"
            palette={palette}
            onPress={() =>
              void addVoltageRule(conn.base, conn.token, {
                mac,
                outlet: 0,
                op: op as VoltageRule['op'],
                volts: Number(volts) || 0,
                action: action as VoltageRule['action'],
              }).then(onChanged)
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  stripBlock: { gap: 8 },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  stripName: { fontSize: 16, fontWeight: '600', flex: 1 },
  stripCount: { fontFamily: F.mono, fontSize: 12 },
  outletBlock: {
    borderRadius: R.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  outletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  outletName: { fontSize: 14, fontWeight: '600', flex: 1 },
  outletMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: F.mono, fontSize: 11, fontWeight: '600' },
  expanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  noEvents: { fontSize: 13, lineHeight: 18 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventTime: { fontFamily: F.monoSemi, fontSize: 22, fontVariant: ['tabular-nums'], minWidth: 70 },
  eventMeta: { flex: 1, gap: 1 },
  eventAction: { fontSize: 13, fontWeight: '700' },
  eventDays: { fontSize: 12 },
  deleteBtn: { padding: 6 },
  rulesBlock: { gap: 8, marginTop: 8 },
  rulesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rulesTitle: { fontSize: 16, fontWeight: '600' },
  form: { gap: 12, borderRadius: R.md, borderWidth: 1, padding: 14 },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { fontFamily: F.monoSemi, fontSize: 28, marginHorizontal: 4 },
  actionSeg: { flexDirection: 'row', gap: 8 },
  actionChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: R.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipText: { fontSize: 14, fontWeight: '600' },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'center' },
});
