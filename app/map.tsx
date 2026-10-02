import { router } from 'expo-router';
import { useEffect } from 'react';

export default function MapLiveActivityRedirect() {
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);

  return null;
}
