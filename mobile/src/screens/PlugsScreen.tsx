import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useConn } from '../server';
import { usePowerk } from '../usePowerk';
import { usePalette } from '../theme';
import { EmptyState, MessageCard } from '../ui/bits';
import { StripCard } from '../ui/parts';

export function PlugsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useI18n();
  const palette = usePalette();
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const { snapshot, error, loading, pending, refresh, command, phoneIp, hubState } = usePowerk();
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

  const strings = {
    name: t('strip_name'),
    fw: (fw: string) => t('strip_fw', fw),
    outlet: (n: number) => t('outlet_n', n),
    on: t('state_on'),
    off: t('state_off'),
    onDetail: (w: string, temp: number) => t('tile_on_detail', w, temp),
    offDetail: (temp: number) => t('tile_off_detail', temp),
    allOn: t('turn_all_on'),
    allOff: t('turn_all_off'),
    wattsNow: t('watts_now'),
    unit: t('unit_watts'),
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          enabled={!direct && conn.configured}
          tintColor={palette.primary}
          colors={[palette.primary]}
        />
      }>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.primary }]}>{t('app_name')}</Text>
          <Text style={[styles.subtitle, { color: palette.onSurfaceVariant }]}>{subtitle}</Text>
        </View>
      </View>

      {error && (
        <MessageCard text={direct ? t('direct_failed') : error} isError palette={palette} />
      )}
      {direct && hubState === 'running' && strips.length === 0 && (
        <MessageCard text={t('direct_waiting_first')} isError={false} palette={palette} />
      )}
      {direct && conn.provisionedIp && phoneIp && conn.provisionedIp !== phoneIp && (
        <MessageCard
          text={t('direct_ip_changed', conn.provisionedIp)}
          isError
          palette={palette}
        />
      )}

      {!direct && !conn.configured ? (
        <EmptyState
          title={t('no_server_title')}
          body={t('no_server_body')}
          actionLabel={t('open_settings')}
          onAction={onOpenSettings}
          palette={palette}
        />
      ) : (
        <>
          {strips.map((strip) => (
            <StripCard
              key={strip.mac}
              strip={strip}
              showMac={strips.length > 1}
              pending={pending}
              strings={strings}
              palette={palette}
              onCommand={command}
            />
          ))}
          {strips.length === 0 && (
            <EmptyState
              title={t('no_strip_title')}
              body={t('no_strip_body')}
              palette={palette}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
});
