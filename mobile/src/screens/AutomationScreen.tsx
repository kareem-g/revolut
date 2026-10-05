import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { usePalette } from '../theme';
import { useConn } from '../server';
import { usePowerk } from '../usePowerk';
import {
  Schedule,
  VoltageRule,
  addSchedule,
  addVoltageRule,
  delSchedule,
  delVoltageRule,
  schedules,
  voltageRules,
} from '../api';
import { BodyText, Card, Field, SectionTitle, Segmented, useToast } from '../ui/bits';
import { TonalButton } from '../ui/parts';

const WEEK = [0, 1, 2, 3, 4, 5, 6];

export function AutomationScreen() {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const { snapshot } = usePowerk();
  const toast = useToast();

  const strips = snapshot?.strips ?? [];
  const mac = strips[0]?.mac ?? '';

  const [scheds, setScheds] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<VoltageRule[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (direct || !conn.configured) return;
    setBusy(true);
    try {
      setScheds(await schedules(conn.base, conn.token));
      setRules(await voltageRules(conn.base, conn.token));
    } catch {
      /* offline */
    }
    setBusy(false);
  }, [direct, conn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (direct) {
    return (
      <Scrollable>
        <Text style={[styles.title, { color: palette.onSurface }]}>{t('automation')}</Text>
        <Card palette={palette}>
          <BodyText text={t('mode_server_desc')} palette={palette} />
        </Card>
      </Scrollable>
    );
  }

  return (
    <Scrollable>
      <Text style={[styles.title, { color: palette.onSurface }]}>{t('automation')}</Text>

      <SectionTitle text={t('schedules')} palette={palette} />
      {scheds.length === 0 && <BodyText text={t('schedules_empty')} palette={palette} />}
      {scheds.map((s) => (
        <Row key={s.id}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: palette.onSurface }]}>
              {outletLabel(t, s.outlet, strips, s.mac)} · {t(s.on ? 'schedule_on' : 'schedule_off')}
            </Text>
            <Text style={[styles.rowSub, { color: palette.onSurfaceVariant }]}>
              {s.time} · {daysLabel(t, s.days)}
            </Text>
          </View>
          <TonalButton
            label={t('delete')}
            variant="outlined"
            palette={palette}
            onPress={() => void delSchedule(conn.base, conn.token, s.id).then(reload)}
          />
        </Row>
      ))}
      <ScheduleForm mac={mac} strips={strips} onAdded={reload} />

      <SectionTitle text={t('voltage_rules')} palette={palette} />
      {rules.length === 0 && <BodyText text={t('voltage_rules_empty')} palette={palette} />}
      {rules.map((r) => (
        <Row key={r.id}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: palette.onSurface }]}>
              {outletLabel(t, r.outlet, strips, r.mac)} · {t(r.action === 'on' ? 'action_on' : 'action_off')}
            </Text>
            <Text style={[styles.rowSub, { color: palette.onSurfaceVariant }]}>
              {t(`op_${r.op}` as never)} {r.volts} V
            </Text>
          </View>
          <TonalButton
            label={t('delete')}
            variant="outlined"
            palette={palette}
            onPress={() => void delVoltageRule(conn.base, conn.token, r.id).then(reload)}
          />
        </Row>
      ))}
      <RuleForm mac={mac} strips={strips} onAdded={reload} />
    </Scrollable>
  );
}

function outletLabel(t: (k: never, ...a: (string | number)[]) => string, outlet: number, strips: { mac: string; name: string }[], mac: string) {
  if (outlet === 0) return t('all_outlets' as never);
  const strip = strips.find((s) => s.mac === mac);
  return `${strip?.name || mac} · ${t('outlet_n' as never, outlet)}`;
}

function daysLabel(t: (k: never, ...a: (string | number)[]) => string, days: number[]) {
  const all = WEEK.every((d) => days.includes(d));
  if (all) return t('days_all' as never);
  const weekdays = [0, 1, 2, 3, 4].every((d) => days.includes(d)) && days.length === 5;
  if (weekdays) return t('days_weekdays' as never);
  return `${days.length} d`;
}

function Scrollable({ children }: { children: React.ReactNode }) {
  return <FlatList data={[0]} keyExtractor={() => 'k'} renderItem={() => <View style={styles.content}>{children}</View>} />;
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function ScheduleForm({ mac, strips, onAdded }: { mac: string; strips: { mac: string; name: string }[]; onAdded: () => void }) {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const [outlet, setOutlet] = useState('0');
  const [on, setOn] = useState(true);
  const [time, setTime] = useState('06:00');
  const [days, setDays] = useState<'all' | 'weekdays' | 'weekend'>('all');

  const submit = async () => {
    const d = days === 'all' ? WEEK : days === 'weekdays' ? [0, 1, 2, 3, 4] : [5, 6];
    try {
      await addSchedule(conn.base, conn.token, { mac, outlet: Number(outlet), on, time, days: d });
      onAdded();
    } catch {}
  };

  return (
    <Card palette={palette}>
      <SectionTitle text={t('add_schedule')} palette={palette} />
      <Segmented palette={palette} value={String(outlet)} onChange={setOutlet} options={['0', '1', '2', '3', '4'].map((v) => ({ value: v, label: v === '0' ? t('all_outlets') : v }))} />
      <Segmented palette={palette} value={on ? 'on' : 'off'} onChange={(v) => setOn(v === 'on')} options={[{ value: 'on', label: t('schedule_on') }, { value: 'off', label: t('schedule_off') }]} />
      <Segmented palette={palette} value={days} onChange={setDays} options={[{ value: 'all', label: t('days_all') }, { value: 'weekdays', label: t('days_weekdays') }, { value: 'weekend', label: t('days_weekend') }]} />
      <Field label={t('time')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" mono palette={palette} />
      <TonalButton label={t('add_schedule')} palette={palette} onPress={() => void submit()} />
    </Card>
  );
}

function RuleForm({ mac, strips, onAdded }: { mac: string; strips: { mac: string; name: string }[]; onAdded: () => void }) {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const [outlet, setOutlet] = useState('0');
  const [op, setOp] = useState('below');
  const [volts, setVolts] = useState('210');
  const [action, setAction] = useState('off');

  const submit = async () => {
    try {
      await addVoltageRule(conn.base, conn.token, { mac, outlet: Number(outlet), op: op as VoltageRule['op'], volts: Number(volts) || 0, action: action as VoltageRule['action'] });
      onAdded();
    } catch {}
  };

  return (
    <Card palette={palette}>
      <SectionTitle text={t('add_voltage_rule')} palette={palette} />
      <Segmented palette={palette} value={String(outlet)} onChange={setOutlet} options={['0', '1', '2', '3', '4'].map((v) => ({ value: v, label: v === '0' ? t('all_outlets') : v }))} />
      <Segmented palette={palette} value={op} onChange={setOp} options={[{ value: 'below', label: t('op_below') }, { value: 'above', label: t('op_above') }]} />
      <Segmented palette={palette} value={action} onChange={setAction} options={[{ value: 'off', label: t('action_off') }, { value: 'on', label: t('action_on') }]} />
      <Field label={t('volts')} value={volts} onChangeText={(v) => setVolts(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" palette={palette} />
      <TonalButton label={t('add_voltage_rule')} palette={palette} onPress={() => void submit()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
});