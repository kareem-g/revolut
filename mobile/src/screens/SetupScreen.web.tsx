import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useI18n } from '../i18n';
import { usePalette } from '../theme';
import { BodyText, Card, SectionTitle } from '../ui/bits';

// Web build: a browser can't join the strip's setup Wi-Fi or open raw TCP to
// 192.168.1.1:30300, so provisioning is not available here.
export function SetupScreen() {
  const { t } = useI18n();
  const palette = usePalette();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: palette.onSurface }]}>{t('prov_title')}</Text>
      <BodyText text={t('prov_intro')} palette={palette} />

      <Card palette={palette}>
        <SectionTitle text={t('setup_title')} palette={palette} />
        <BodyText text={t('setup_step_1')} palette={palette} />
        <BodyText text={t('setup_step_2')} palette={palette} />
        <Text style={[styles.code, { color: palette.onSurfaceVariant }]}>
          python powerk.py provision --ip &lt;ip&gt; --ssid WIFI --password PW
        </Text>
        <BodyText text={t('setup_step_4')} palette={palette} />
        <BodyText text={t('web_no_provision')} palette={palette} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  code: { fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
});