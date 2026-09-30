import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerRootComponent } from 'expo';

import App from './App';

// Apply the stored language's layout direction before the app renders.
// Direction changes take effect on the next launch; texts switch immediately.
AsyncStorage.getItem('lang')
  .then((lang) => {
    if (lang === 'ar') I18nManager.forceRTL(true);
    else if (lang === 'en') I18nManager.forceRTL(false);
    else I18nManager.allowRTL(true);
  })
  .catch(() => undefined);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
