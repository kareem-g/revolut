import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from '../i18n';
import { useConn } from '../server';
import { usePowerk } from '../usePowerk';
import { F, R, usePalette } from '../theme';
import { History, history as fetchHistory, rename as apiRename } from '../api';
import { startScheduleEngine, pauseScheduleEngine } from '../schedules';
import { useSchedules } from '../useSchedules';
import { useNames } from '../useNames';
import { useNavigation } from '@react-navigation/native';
import { Card, Field, MessageCard, SectionTitle, useToast } from '../ui/bits';
import { StripCard, TonalButton } from '../ui/parts';

const isDefaultName = (s: { name: string; mac: string }) =>
  !s.name || s.name === `MTTL ${s.mac.slice(-7)}`;

export function PlugsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const { snapshot, error, pending, command, phoneIp, hubState } = usePowerk();
  const [lastError, setLastError] = useState<string | null>(null);
  const [history, setHistory] = useState<History>({});
  const [editing, setEditing] = useState<string | null>(null);
  const { count: scheduleCountFor } = useSchedules();
  const { stripName: displayStripName, outletName: displayOutletName } = useNames();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void }>();

  // direct mode: schedules fire locally through the normal command path.
  // server mode: powerk.py executes them; the app engine stays paused.
  useEffect(() => {
    if (direct) startScheduleEngine(command);
    else pauseScheduleEngine();
  });

  useEffect(() => {
    AsyncStorage.getItem('last_js_error').then((v) => {
      if (v) {
        setLastError(v.split('\n')[0]);
        AsyncStorage.removeItem('last_js_error');
      }
    });
  }, []);

  useEffect(() => {
    if (direct || !conn.configured) return;
    fetchHistory(conn.base, conn.token)
      .then(setHistory)
      .catch(() => setHistory({}));
  }, [direct, conn, snapshot?.strips.length]);

  const strips = snapshot?.strips ?? [];
  const onlineCount = strips.filter((s) => s.online).length;
  const hostLabel = direct ? t('direct_host_label') : conn.host;

  const subtitle = !direct && !conn.configured
    ? t('header_no_server')
    : onlineCount > 0
      ? t('header_online', onlineCount, hostLabel)
      : strips.length > 0
        ? t('header_known_offline', strips.length)
        : t('header_waiting', hostLabel);

  const stringsFor = (strip: { mac: string; name: string; outlets: { n: number; name: string }[] }) => ({
    name: displayStripName(strip.mac, isDefaultName(strip) ? t('strip_name') : strip.name),
    fw: (fw: string) => t('strip_fw', fw),
    outlet: (n: number) =>
      displayOutletName(
        strip.mac,
        n,
        strip.outlets.find((o) => o.n === n)?.name || t('outlet_n', n),
      ),
    on: t('state_on'),
    off: t('state_off'),
    onDetail: (w: string, temp: number) => t('tile_on_detail', w, temp),
    offDetail: (temp: number) => t('tile_off_detail', temp),
    allOn: t('turn_all_on'),
    allOff: t('turn_all_off'),
    wattsNow: t('watts_now'),
    unit: t('unit_watts'),
  });

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 6 }]}>
      <Text style={[styles.brand, { color: palette.primary }]}>{t('app_name')}</Text>
      <Text style={[styles.subtitle, { color: palette.onSurfaceVariant }]}>{subtitle}</Text>

      {error && <MessageCard text={direct ? t('direct_failed') : error} isError palette={palette} />}
      {lastError && <MessageCard text={lastError} isError palette={palette} />}
      {direct && hubState === 'running' && strips.length === 0 && (
        <MessageCard text={t('direct_waiting_first')} isError={false} palette={palette} />
      )}
      {direct && conn.provisionedIp && phoneIp && conn.provisionedIp !== phoneIp && (
        <MessageCard text={t('direct_ip_changed', conn.provisionedIp)} isError palette={palette} />
      )}

      {!direct && !conn.configured ? (
        <View style={styles.empty}>
          <Text style={{ color: palette.onSurface, fontSize: 17, fontWeight: '600' }}>{t('no_server_title')}</Text>
          <Text style={{ color: palette.onSurfaceVariant, fontSize: 14, textAlign: 'center', marginTop: 6 }}>{t('no_server_body')}</Text>
          <TonalButton label={t('open_settings')} palette={palette} onPress={onOpenSettings} style={{ marginTop: 18 }} />
        </View>
      ) : (
        <>
          {Object.keys(history).length > 0 && <UsageCard history={history} palette={palette} />}
          {strips.map((strip) => (
            <StripCard
              key={strip.mac}
              strip={strip}
              showMac={strips.length > 1 && isDefaultName(strip)}
              pending={pending}
              strings={stringsFor(strip)}
              palette={palette}
              onCommand={command}
              onRenameStrip={() => setEditing(strip.mac)}
              scheduleCount={(o) => scheduleCountFor(strip.mac, o)}
              onOpenSchedule={(o) => nav.navigate('automation', { mac: strip.mac, outlet: o })}
            />
          ))}
          {strips.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ color: palette.onSurface, fontSize: 17, fontWeight: '600' }}>{t('no_strip_title')}</Text>
              <Text style={{ color: palette.onSurfaceVariant, fontSize: 14, textAlign: 'center', marginTop: 6 }}>{t('no_strip_body')}</Text>
            </View>
          )}
        </>
      )}

      {editing && (
        <RenameModal mac={editing} strips={snapshot?.strips ?? []} onClose={() => setEditing(null)} />
      )}
    </ScrollView>
  );
}

function UsageCard({ history, palette }: { history: History; palette: ReturnType<typeof usePalette> }) {
  const { t } = useI18n();
  const entries = Object.values(history);
  const totalKwh = entries.reduce((s, e) => s + e.total_kwh, 0);
  const totalCost = entries.reduce((s, e) => s + e.cost, 0);
  const currency = entries[0]?.currency ?? '$';
  return (
    <Card palette={palette}>
      <SectionTitle text={t('usage_and_cost')} palette={palette} />
      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View>
          <Text style={{ color: palette.onSurfaceVariant, fontSize: 13 }}>{t('usage_total')}</Text>
          <Text style={{ color: palette.onSurface, fontSize: 20, fontWeight: '700' }}>{totalKwh} {t('kwh')}</Text>
        </View>
        <View>
          <Text style={{ color: palette.onSurfaceVariant, fontSize: 13 }}>{t('cost_title')}</Text>
          <Text style={{ color: palette.onSurface, fontSize: 20, fontWeight: '700' }}>{currency} {totalCost.toFixed(2)}</Text>
        </View>
      </View>
    </Card>
  );
}

function RenameModal({ mac, strips, onClose }: { mac: string; strips: { mac: string; name: string; outlets: { n: number; name: string }[] }[]; onClose: () => void }) {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const toast = useToast();
  const { stripName: displayStripName, outletName: displayOutletName, saveLocal } = useNames();
  const strip = strips.find((s) => s.mac === mac);

  const [stripName, setStripName] = useState(
    strip ? displayStripName(mac, isDefaultName(strip) ? '' : strip.name) : '',
  );
  const [outletNames, setOutletNames] = useState<Record<number, string>>(
    Object.fromEntries(
      (strip?.outlets ?? []).map((o) => [
        o.n,
        displayOutletName(mac, o.n, o.name === `Outlet ${o.n}` ? '' : o.name),
      ]),
    ),
  );

  const save = async () => {
    if (direct) {
      // the hub protocol has no names — keep a local overlay on this device
      await saveLocal(mac, {
        strip: stripName || null,
        outlets: Object.fromEntries(
          Object.entries(outletNames).map(([n, name]) => [n, name || null]),
        ),
      });
      toast(t('saved'));
      onClose();
      return;
    }
    try {
      await apiRename(conn.base, conn.token, { mac, name: stripName || undefined });
      for (const o of strip?.outlets ?? []) {
        await apiRename(conn.base, conn.token, { mac, outlet: o.n, outletName: outletNames[o.n] || undefined });
      }
      toast(t('saved'));
      onClose();
    } catch (e) {
      toast(t('connection_failed_detail', e instanceof Error ? e.message : ''));
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modal,
            { backgroundColor: palette.surfaceLow, borderColor: palette.outlineVariant },
          ]}>
          <SectionTitle text={t('rename_strip')} palette={palette} />
          <Field label={t('name_hint')} value={stripName} onChangeText={setStripName} palette={palette} placeholder={t('strip_name')} />
          {(strip?.outlets ?? []).map((o) => (
            <Field key={o.n} label={t('outlet_n', o.n)} value={outletNames[o.n] ?? ''} onChangeText={(v) => setOutletNames((p) => ({ ...p, [o.n]: v }))} palette={palette} />
          ))}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <TonalButton label={t('cancel')} variant="outlined" palette={palette} style={{ flex: 1 }} onPress={onClose} />
            <TonalButton label={t('save')} palette={palette} style={{ flex: 1 }} onPress={() => void save()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  brand: { fontFamily: F.wordmark, fontSize: 24, lineHeight: 30 },
  subtitle: { fontSize: 13, marginBottom: 4 },
  empty: { alignItems: 'center', marginTop: 48 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { borderRadius: R.lg, borderWidth: 1, padding: 18, gap: 12, maxHeight: '85%' },
});