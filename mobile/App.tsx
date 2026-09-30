import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider, useI18n } from './src/i18n';
import { ConnProvider } from './src/server';
import { usePalette } from './src/theme';
import { SplashGate, ToastProvider } from './src/ui/bits';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { PlugsScreen } from './src/screens/PlugsScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function Shell() {
  const palette = usePalette();
  const { t } = useI18n();
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: palette.background,
      card: palette.surfaceLow,
      text: palette.onSurface,
      primary: palette.primary,
      border: palette.outlineVariant,
    },
  };
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: palette.primary,
            tabBarInactiveTintColor: palette.onSurfaceVariant,
            tabBarStyle: { borderTopColor: palette.outlineVariant },
            tabBarIcon: ({ focused, color, size }) => {
              const icon =
                route.name === 'plugs'
                  ? focused
                    ? 'home'
                    : 'home-outline'
                  : route.name === 'setup'
                    ? focused
                      ? 'flash'
                      : 'flash-outline'
                    : focused
                      ? 'settings'
                      : 'settings-outline';
              return <Ionicons name={icon as never} size={size} color={color} />;
            },
          })}>
          <Tab.Screen
            name="plugs"
            component={PlugsScreenWithNav}
            options={{ title: t('tab_plugs') }}
          />
          <Tab.Screen name="setup" component={SetupScreen} options={{ title: t('tab_setup') }} />
          <Tab.Screen
            name="settings"
            component={SettingsScreenWithNav}
            options={{ title: t('tab_settings') }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <SplashGate ms={1100} palette={palette} title={t('app_name')} tagline={t('splash_tagline')} />
      <StatusBar style="auto" />
    </View>
  );
}

// tab screens need navigation callbacks for their cross-tab buttons
function PlugsScreenWithNav() {
  const nav = useNavigation<{ navigate: (name: string) => void }>();
  return <PlugsScreen onOpenSettings={() => nav.navigate('settings')} />;
}
function SettingsScreenWithNav() {
  const nav = useNavigation<{ navigate: (name: string) => void }>();
  return <SettingsScreen onOpenSetup={() => nav.navigate('setup')} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ConnProvider>
          <I18nProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </I18nProvider>
        </ConnProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
