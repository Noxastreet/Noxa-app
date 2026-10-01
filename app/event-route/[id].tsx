import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

export default function EventRouteLiveActivityRedirect() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!eventId) {
      router.replace('/(tabs)');
      return;
    }

    router.replace({
      pathname: '/(tabs)',
      params: { focusEventId: eventId, mapMode: 'route' },
    });
  }, [eventId]);

  return null;
}
