import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

// Apply the stored language's layout direction before the app renders.
// Direction changes take effect on the next launch; texts switch immediately.
AsyncStorage.getItem('lang')
  .then((lang) => {
    if (lang === 'ar') I18nManager.forceRTL(true);
    else if (lang === 'en') I18nManager.forceRTL(false);
    else I18nManager.allowRTL(true);
  })
  .catch(() => undefined);

// Persist any fatal JS error so the next launch (or the Plugs banner) can show
// what happened instead of the app silently exiting.
const ErrorUtilsGlobal = (globalThis as { ErrorUtils?: any }).ErrorUtils;
if (ErrorUtilsGlobal?.getGlobalHandler) {
  const original = ErrorUtilsGlobal.getGlobalHandler();
  ErrorUtilsGlobal.setGlobalHandler((error: unknown, isFatal: boolean) => {
    try {
      const e = error as { message?: string; stack?: string };
      AsyncStorage.setItem(
        'last_js_error',
        `${e?.message ?? String(error)}\n${e?.stack ?? ''}`,
      );
    } catch {}
    original(error, isFatal);
  });
}

// A crash while the App module tree is first evaluated would otherwise kill the
// process with nothing on screen; show it instead.
function BootErrorScreen({ error }: { error: unknown }) {
  const e = error as { message?: string; stack?: string };
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: '#0F1511', padding: 24, justifyContent: 'center' } },
    React.createElement(
      Text,
      { style: { color: '#FFB4AB', fontSize: 20, fontWeight: '700', marginBottom: 12 } },
      'powerk failed to start',
    ),
    React.createElement(
      ScrollView,
      {},
      React.createElement(
        Text,
        { style: { color: '#DEE4DE', fontSize: 14, lineHeight: 20 } },
        e?.message ?? String(error),
      ),
      React.createElement(
        Text,
        { style: { color: '#8A938C', fontSize: 12, marginTop: 12, lineHeight: 17 } },
        e?.stack ?? '',
      ),
    ),
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// requiring ./App lazily lets a module-evaluation crash render BootErrorScreen.
registerRootComponent(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./App').default;
  } catch (error) {
    try {
      AsyncStorage.setItem('last_js_error', String((error as Error)?.message ?? error));
    } catch {}
    return () => React.createElement(BootErrorScreen, { error });
  }
});
