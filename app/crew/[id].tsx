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
          accessibilityHint="Opens Crew settings and member management"
          accessibilityLabel="Manage Crew"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => router.push({ pathname: '/crew-manage', params: { id: crewId } })}
          style={({ pressed }) => [
            styles.manageButton,
            { bottom: insets.bottom + spacing.md },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.manageIcon}>
            <Ionicons name="shield-checkmark" size={17} color={colors.text} />
          </View>
          <View style={styles.manageCopy}>
            <Text style={styles.manageEyebrow}>{role === 'owner' ? 'OWNER TOOLS' : 'ADMIN TOOLS'}</Text>
            <Text style={styles.manageText}>Manage Crew</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
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
    minHeight: 52,
    minWidth: 184,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    ...shadows.card,
  },
  manageIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  manageCopy: { flex: 1, minWidth: 0 },
  manageEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  manageText: {
    marginTop: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});
