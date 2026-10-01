import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n';
import { useConn, WifiCreds } from '../server';
import { usePalette } from '../theme';
import { isIpv4, SETUP_HOST, SETUP_PORT, credsValid, stripCodeToNetwork } from '../provision';
import { joinNetwork, rejoinHome } from '../wifi';
import { provisionStrip } from '../setup-conn';
import { snapshot as apiSnapshot } from '../api';
import { hub } from '../hub/hub';
import { hasWifiModule, loadTcpSocket } from '../native';
import { BodyText, Card, Field, MessageCard, SectionTitle, useToast } from '../ui/bits';
import { TonalButton } from '../ui/parts';
import { R } from '../theme';

type Phase = 'form' | 'join' | 'send' | 'done';
type LogLine = { key: string; args: string[] };

const DETECT_POLL_MS = 1500;
const DETECT_TIMEOUT_MS = 3 * 60 * 1000;

/** Quick reachability probe of the strip's setup service. */
function probeSetupPort(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const TcpSocket = loadTcpSocket();
    if (!TcpSocket) return resolve(false);
    let settled = false;
    const socket = TcpSocket.createConnection({ host: SETUP_HOST, port: SETUP_PORT }, () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(false);
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(false);
    }, timeoutMs);
  });
}

function currentSsid(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!hasWifiModule()) return resolve(null);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WifiManager = require('react-native-wifi-reborn').default;
      WifiManager.getCurrentWifiSSID()
        .then((ssid: string) => resolve(ssid || null))
        .catch(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

const isStripSsid = (ssid: string | null) =>
  !!ssid && ssid.trim().toLowerCase().startsWith('tonly_tap_');

export function SetupScreen() {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('form');
  const [serverIp, setServerIp] = useState(direct ? conn.provisionedIp || '' : conn.host);
  const [stripInput, setStripInput] = useState(conn.homeWifi.ssid.startsWith('TONLY_TAP_') ? conn.homeWifi.ssid : '');
  const [homeSsid, setHomeSsid] = useState(conn.homeWifi.ssid);
  const [homePassword, setHomePassword] = useState(conn.homeWifi.password);
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<'idle' | 'checking' | string>('idle');

  const stripNet = stripCodeToNetwork(stripInput);

  // Prefill the phone's Wi-Fi IP once it is known (direct mode).
  useEffect(() => {
    if (direct && !serverIp) setServerIp(conn.provisionedIp || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.provisionedIp, direct]);

  // Start detection as soon as we enter the join phase.
  useEffect(() => {
    if (phase !== 'join') return;
    let alive = true;
    const deadline = Date.now() + DETECT_TIMEOUT_MS;
    const tick = async () => {
      while (alive && Date.now() < deadline) {
        const ssid = await currentSsid();
        if (isStripSsid(ssid) || (await probeSetupPort())) {
          if (!alive) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          setPhase('send');
          return;
        }
        await new Promise((r) => setTimeout(r, DETECT_POLL_MS));
      }
      if (alive) setErrorText(t('err_not_on_strip_network', `TONLY_TAP_…`));
    };
    void tick();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Run the provisioning exchange once we enter the send phase.
  useEffect(() => {
    if (phase !== 'send') return;
    let alive = true;
    setBusy(true);
    setErrorText(null);
    const home: WifiCreds = { ssid: homeSsid.trim(), password: homePassword };
    provisionStrip(serverIp.trim(), home, (key, ...args) => {
      if (alive) setLog((prev) => [...prev.slice(-40), { key, args }]);
    })
      .then(() => {
        if (!alive) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setPhase('done');
      })
      .catch((e: { key?: string; args?: string[]; message?: string }) => {
        if (!alive) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setErrorText(
          e.key ? t(e.key as never, ...(e.args ?? [])) : e.message || t('command_failed'),
        );
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    if (!isIpv4(serverIp)) return toast(t('err_ipv4'));
    if (!stripNet) return toast(t('err_code'));
    const home = { ssid: homeSsid.trim(), password: homePassword };
    if (!credsValid(home)) return toast(t('err_wifi_chars'));
    conn.setHomeWifi(home);
    conn.setProvisionedIp(serverIp.trim());
    setErrorText(null);
    setLog([]);
    setPhase('join');
  };

  const joinAutomatically = async () => {
    if (!stripNet) return;
    try {
      await joinNetwork(stripNet.ssid, stripNet.password);
      // detection loop will pick the network up and advance
    } catch (e) {
      toast(t('err_join', (e as Error)?.message ?? ''));
    }
  };

  const openWifiSettings = async () => {
    if (Platform.OS === 'ios') {
      try {
        await Linking.openURL('App-Prefs:WIFI');
        return;
      } catch {}
      try {
        await Linking.openURL('app-settings:');
        return;
      } catch {}
      await Linking.openSettings();
    } else {
      try {
        await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      } catch {
        await Linking.openSettings();
      }
    }
  };

  const rejoin = async () => {
    try {
      setBusy(true);
      await rejoinHome({ ssid: homeSsid.trim(), password: homePassword });
      toast(t('prov_rejoining', homeSsid.trim()));
    } catch {
      toast(t('prov_rejoin_failed'));
    } finally {
      setBusy(false);
    }
  };

  const checkServer = async () => {
    setCheckState('checking');
    const deadline = Date.now() + 30000;
    for (;;) {
      if (direct) {
        // read the live hub, not a captured render snapshot
        const found = hub.snapshot().strips;
        if (found.length > 0) {
          setCheckState(
            found.some((s) => s.online) ? t('prov_check_found') : t('prov_check_offline'),
          );
          return;
        }
      } else {
        try {
          const snap = await apiSnapshot(conn.base, conn.token);
          if (snap.strips.some((s) => s.online)) {
            setCheckState(t('prov_check_found'));
            return;
          }
          if (snap.strips.length > 0) {
            setCheckState(t('prov_check_offline'));
            return;
          }
          setCheckState(t('prov_check_none'));
          return;
        } catch {
          // keep retrying until the deadline (phone may still be switching Wi-Fi)
        }
      }
      if (Date.now() > deadline) {
        setCheckState(direct ? t('prov_check_offline') : t('prov_check_failed'));
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: palette.onSurface }]}>{t('prov_title')}</Text>
      <BodyText text={t('prov_intro')} palette={palette} />

      {phase === 'form' && (
        <>
          <Card palette={palette}>
            <SectionTitle text={t('prov_step_server')} palette={palette} />
            <Field
              label={t('prov_server_label')}
              hint={direct ? t('prov_server_hint_direct') : t('prov_server_hint')}
              value={serverIp}
              onChangeText={setServerIp}
              keyboardType="numbers-and-punctuation"
              mono
              palette={palette}
              placeholder="192.168.1.42"
            />
          </Card>

          <Card palette={palette}>
            <SectionTitle text={t('prov_step_strip')} palette={palette} />
            <Field
              label={t('prov_strip_label')}
              hint={t('prov_strip_hint')}
              value={stripInput}
              onChangeText={setStripInput}
              autoCapitalize="characters"
              mono
              palette={palette}
              placeholder="TONLY_TAP_91C0C4C"
            />
            {stripNet && (
              <>
                <Text style={[styles.derived, { color: palette.primary }]}>
                  {t('prov_ssid_preview', stripNet.ssid)}
                </Text>
                <Field
                  label={t('prov_password_derived')}
                  value={stripNet.password}
                  onChangeText={() => undefined}
                  editable={false}
                  mono
                  palette={palette}
                />
              </>
            )}
          </Card>

          <Card palette={palette}>
            <SectionTitle text={t('prov_step_wifi')} palette={palette} />
            <Field
              label={t('prov_wifi_ssid')}
              value={homeSsid}
              onChangeText={setHomeSsid}
              palette={palette}
              placeholder="HOMEWIFI"
            />
            <Field
              label={t('prov_wifi_password')}
              value={homePassword}
              onChangeText={setHomePassword}
              secure
              palette={palette}
            />
            <BodyText
              text={
                conn.homeWifi.ssid && homeSsid === conn.homeWifi.ssid
                  ? t('prov_wifi_stored')
                  : t('prov_wifi_hint')
              }
              palette={palette}
            />
          </Card>

          <TonalButton
            label={t('prov_start')}
            variant="filled"
            palette={palette}
            onPress={start}
          />
        </>
      )}

      {phase === 'join' && (
        <Card palette={palette}>
          <SectionTitle text={t('prov_step_join')} palette={palette} />
          <BodyText text={t('prov_hold_button')} palette={palette} />
          <Text style={[styles.detecting, { color: palette.primary }]}>{t('prov_detecting')}</Text>
          <TonalButton
            label={t('prov_join_auto', stripNet?.ssid ?? '')}
            palette={palette}
            onPress={() => void joinAutomatically()}
          />
          <TonalButton
            label={t('prov_open_wifi_settings')}
            variant="outlined"
            palette={palette}
            onPress={() => void openWifiSettings()}
          />
          <BodyText
            text={Platform.OS === 'ios' ? t('prov_join_note_ios') : t('prov_join_note_android')}
            palette={palette}
          />
          <TonalButton label={t('prov_back')} variant="outlined" palette={palette} onPress={() => setPhase('form')} />
        </Card>
      )}

      {phase === 'send' && (
        <Card palette={palette}>
          <SectionTitle text={t('prov_step_send')} palette={palette} />
          <BodyText text={busy ? t('prov_sending') : t('prov_send_note')} palette={palette} />
          <View style={[styles.log, { backgroundColor: palette.surfaceLowest }]}>
            {log.map((l, i) => (
              <Text key={i} style={[styles.logLine, { color: palette.onSurface }, styles.mono]}>
                {t(l.key as never, ...l.args)}
              </Text>
            ))}
          </View>
          {errorText && (
            <MessageCard text={errorText} isError palette={palette} />
          )}
          {errorText && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TonalButton
                label={t('common_retry')}
                palette={palette}
                style={{ flex: 1 }}
                onPress={() => {
                  setLog([]);
                  setErrorText(null);
                  setPhase('join');
                  setTimeout(() => setPhase('send'), 50);
                }}
              />
              <TonalButton
                label={t('prov_back')}
                variant="outlined"
                palette={palette}
                style={{ flex: 1 }}
                onPress={() => setPhase('form')}
              />
            </View>
          )}
        </Card>
      )}

      {phase === 'done' && (
        <Card palette={palette}>
          <SectionTitle text={t('prov_done_title')} palette={palette} />
          <BodyText text={t('prov_done_body')} palette={palette} />
          <TonalButton
            label={t('prov_rejoin_button')}
            palette={palette}
            pending={busy}
            onPress={() => void rejoin()}
          />
          <TonalButton
            label={checkState === 'checking' ? t('prov_checking') : t('prov_check_button')}
            pending={checkState === 'checking'}
            variant="outlined"
            palette={palette}
            onPress={() => void checkServer()}
          />
          {typeof checkState === 'string' &&
            checkState !== 'checking' &&
            checkState !== 'idle' && <MessageCard text={checkState} isError={false} palette={palette} />}
          <TonalButton
            label={t('prov_start')}
            variant="outlined"
            palette={palette}
            onPress={() => {
              setCheckState('idle');
              setPhase('form');
            }}
          />
          <BodyText text={t('direct_hint')} palette={palette} />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  derived: { fontSize: 13, fontWeight: '600' },
  detecting: { fontSize: 14, fontWeight: '600' },
  log: {
    borderRadius: R.sm,
    padding: 12,
    minHeight: 88,
    justifyContent: 'flex-end',
  },
  logLine: { fontSize: 12, lineHeight: 18 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
});
