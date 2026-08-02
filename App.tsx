import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoRoot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';

import { getClientEnvStatus } from './src/config/env';
import { NoxaConfigurationErrorScreen } from './src/screens/NoxaConfigurationErrorScreen';
import { NoxaSplashScreen } from './src/screens/NoxaSplashScreen';

declare const require: NodeRequire & {
  context: (directory: string) => any;
};

SplashScreen.preventAutoHideAsync().catch(() => undefined);

console.log('[App] module loaded');

const clientEnvStatus = getClientEnvStatus();
const routerContext = clientEnvStatus.isReady
  ? require.context('./app')
  : undefined;

export default function App() {
  console.log('[App] rendered');
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const hasHiddenNativeSplash = useRef(false);

  useEffect(() => {
    console.log('[Splash] root mounted');

    const timeout = setTimeout(() => {
      if (!hasHiddenNativeSplash.current) {
        hasHiddenNativeSplash.current = true;

        SplashScreen.hideAsync()
          .then(() => {
            console.log('[Splash] native splash hidden');
          })
          .catch((error) => {
            console.warn('Fallback splash hide failed:', error);
          });
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  const handleSplashLayout = useCallback(() => {
    console.log('[Splash] root layout ready');

    if (hasHiddenNativeSplash.current) {
      return;
    }

    hasHiddenNativeSplash.current = true;

    SplashScreen.hideAsync()
      .then(() => {
        console.log('[Splash] native splash hidden');
      })
      .catch((error) => {
        console.warn('Failed to hide native splash:', error);
      });
  }, []);

  const handleSplashFinish = useCallback(() => {
    setIsSplashComplete(true);
  }, []);

  if (!clientEnvStatus.isReady || !routerContext) {
    return (
      <NoxaConfigurationErrorScreen
        status={clientEnvStatus}
        onLayoutReady={handleSplashLayout}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#080A0F' }}>
      {isSplashComplete ? (
        <ExpoRoot context={routerContext} />
      ) : (
        <NoxaSplashScreen onFinish={handleSplashFinish} onLayoutReady={handleSplashLayout} />
      )}
    </View>
  );
}
