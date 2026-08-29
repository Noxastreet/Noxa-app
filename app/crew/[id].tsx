import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CanonicalCrewDetailScreen from '@/src/features/crews-events/CanonicalCrewDetailScreen';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadows, spacing } from '@/src/theme';

type CrewRole = 'owner' | 'admin' | 'member';

export default function CrewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<CrewRole | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId || !crewId) {
          if (active) setRole(null);
          return;
        }
        const { data } = await supabase
          .from('crew_members')
          .select('role')
          .eq('crew_id', crewId)
          .eq('user_id', userId)
          .maybeSingle();
        if (active) setRole((data?.role as CrewRole | undefined) ?? null);
      })();
      return () => {
        active = false;
      };
    }, [crewId]),
  );

  const canManage = role === 'owner' || role === 'admin';

  return (
    <View style={styles.root}>
      <CanonicalCrewDetailScreen />
      {canManage ? (
        <Pressable
          accessibilityLabel="Manage Crew"
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/crew-manage', params: { id: crewId } })}
          style={({ pressed }) => [
            styles.manageButton,
            { bottom: insets.bottom + 20 },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.text} />
          <Text style={styles.manageText}>MANAGE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  manageButton: {
    position: 'absolute',
    right: spacing.md,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    ...shadows.card,
  },
  manageText: {
    color: colors.text,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
