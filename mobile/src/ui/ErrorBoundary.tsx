import React from 'react';
import { ScrollView, Text, View } from 'react-native';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render-time crash shows its message on screen
 * instead of silently killing the app right after the splash.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // persist for the next launch; AsyncStorage may itself be unavailable, ignore
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem('last_js_error', `${error.message}\n${info.componentStack ?? ''}`);
    } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#0F1511', padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: '#FFB4AB', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
          powerk hit an error
        </Text>
        <ScrollView>
          <Text style={{ color: '#DEE4DE', fontSize: 14, lineHeight: 20 }}>
            {this.state.error.message}
          </Text>
          <Text style={{ color: '#8A938C', fontSize: 12, marginTop: 12, lineHeight: 17 }}>
            {this.state.error.stack}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
