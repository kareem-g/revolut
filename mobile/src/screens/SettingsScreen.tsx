import React, { useState } from 'react';
import { I18nManager, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useConn } from '../server';
import { usePowerk } from '../usePowerk';
import { usePalette } from '../theme';
import { snapshot as apiSnapshot } from '../api';
import {
  BodyText,
  Card,
  Field,
  MessageCard,
  SectionTitle,
  Segmented,
  useToast,
} from '../ui/bits';
import { TonalButton } from '../ui/parts';
import { DEVICE_PORT } from '../hub/server';

export function SettingsScreen({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { t, lang, setLang } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const { phoneIp, hubState } = usePowerk();
  const toast = useToast();

  const [host, setHost] = useState(conn.host);
  const [port, setPort] = useState(String(conn.port));
  const [token, setToken] = useState(conn.token);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const commit = () => conn.save(host, Number(port) || 8080, token);

  const test = async () => {
    commit();
    setBusy(true);
    setStatus(null);
    try {
      const snap = await apiSnapshot(conn.base, conn.token);
      setStatus(
        t('connected_summary', snap.strips.length, snap.strips.filter((s) => s.online).length),
      );
      setStatusOk(true);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'connection failed');
      setStatusOk(false);
    }
    setBusy(false);
  };

  // layout direction applied at launch can lag behind a language change
  const directionMismatch =
    (lang === 'ar' && !I18nManager.isRTL) || (lang === 'en' && I18nManager.isRTL);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: palette.onSurface }]}>{t('settings_title')}</Text>

      <Card palette={palette}>
        <SectionTitle text={t('language_title')} palette={palette} />
        <Segmented
          palette={palette}
          value={lang ?? 'system'}
          onChange={(v) => setLang(v === 'system' ? null : v)}
          options={[
            { value: 'system', label: t('lang_system') },
            { value: 'en', label: t('lang_english') },
            { value: 'ar', label: t('lang_arabic') },
          ]}
        />
        {directionMismatch && (
          <BodyText text={t('lang_rtl_note')} palette={palette} />
        )}
      </Card>

      <Card palette={palette}>
        <SectionTitle text={t('mode_title')} palette={palette} />
        {Platform.OS !== 'web' &&
          <Segmented
            palette={palette}
            value={conn.mode}
            onChange={conn.setMode}
            options={[
              { value: 'direct', label: t('mode_direct') },
              { value: 'server', label: t('mode_server') },
            ]}
          />}
        <BodyText
          text={conn.mode === 'direct' ? t('mode_direct_desc') : t('mode_server_desc')}
          palette={palette}
        />

        {conn.mode === 'direct' ? (
          <>
            <View style={[styles.statusBox, { backgroundColor: palette.secondaryContainer }]}>
              <Text style={[styles.statusText, { color: palette.onSecondaryContainer }]}>
                {hubState === 'failed'
                  ? t('direct_failed')
                  : t('direct_running', DEVICE_PORT)}
              </Text>
              {phoneIp && (
                <Text style={[styles.statusText, { color: palette.onSecondaryContainer }]}>
                  {t('direct_ip', phoneIp)}
                </Text>
              )}
            </View>
            <BodyText text={t('lang_rtl_note')} palette={palette} />
            <TonalButton label={t('prov_title')} palette={palette} onPress={onOpenSetup} />
          </>
        ) : (
          <>
            <BodyText text={t('server_body')} palette={palette} />
            <Field
              label={t('field_host')}
              value={host}
              onChangeText={setHost}
              palette={palette}
              placeholder="192.168.1.14"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field
                label={t('field_port')}
                value={port}
                onChangeText={(v) => setPort(v.replace(/\D/g, '').slice(0, 5))}
                keyboardType="numeric"
                palette={palette}
                style={{ flex: 1 }}
              />
              <Field
                label={t('field_token')}
                value={token}
                onChangeText={setToken}
                palette={palette}
                style={{ flex: 1.4 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TonalButton
                label={t('save')}
                variant="filled"
                palette={palette}
                style={{ flex: 1 }}
                onPress={() => {
                  commit();
                  toast(t('saved'));
                }}
              />
              <TonalButton
                label={t('test')}
                palette={palette}
                pending={busy}
                enabled={!busy}
                style={{ flex: 1 }}
                onPress={() => void test()}
              />
            </View>
            {status && <MessageCard text={status} isError={!statusOk} palette={palette} />}
            <TonalButton
              label={t('open_web_ui')}
              variant="outlined"
              palette={palette}
              enabled={conn.configured}
              onPress={() => {
                commit();
                Linking.openURL(conn.base).catch(() => undefined);
              }}
            />
          </>
        )}
      </Card>

      <Card palette={palette}>
        <SectionTitle text={t('setup_title')} palette={palette} />
        <SetupStep n={1} text={t('setup_step_1')} palette={palette} />
        <SetupStep n={2} text={t('setup_step_2')} palette={palette} />
        <SetupStep n={3} text={t('setup_step_3')} palette={palette} />
        <TonalButton label={t('prov_title')} variant="outlined" palette={palette} onPress={onOpenSetup} />
        <SetupStep n={4} text={t('setup_step_4')} palette={palette} />
        <BodyText text={t('setup_footer')} palette={palette} />
      </Card>
    </ScrollView>
  );
}

function SetupStep({ n, text, palette }: { n: number; text: string; palette: ReturnType<typeof usePalette> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View
        style={[
          styles.stepBadge,
          { backgroundColor: palette.primaryContainer },
        ]}>
        <Text style={[styles.stepBadgeText, { color: palette.onPrimaryContainer }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: palette.onSurface, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  statusBox: { borderRadius: 12, padding: 14, gap: 6 },
  statusText: { fontSize: 14, fontWeight: '500' },
  stepBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontSize: 11, fontWeight: '700' },
  stepText: { fontSize: 14, lineHeight: 20 },
});
