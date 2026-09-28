import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/src/theme';

export type DriveTogetherParticipantMetric = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  distanceLabel: string;
  stale?: boolean;
  self?: boolean;
};

export function DriveTogetherParticipantRail({
  entries,
  top,
}: {
  entries: DriveTogetherParticipantMetric[];
  top: number;
}) {
  if (!entries.length) return null;

  return (
    <View pointerEvents="none" style={[styles.rail, { top }]}>
      {entries.slice(0, 8).map((entry) => (
        <View
          accessibilityLabel={`${entry.displayName}: ${entry.distanceLabel}`}
          key={entry.userId}
          style={[styles.row, entry.stale && styles.rowStale]}
        >
          <View style={[styles.avatarShell, entry.self && styles.avatarSelf]}>
            {entry.avatarUrl ? (
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: entry.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <Text style={styles.initials}>
                {entry.displayName.trim().slice(0, 1).toUpperCase() || 'N'}
              </Text>
            )}
          </View>
          <View style={styles.distancePill}>
            <Text numberOfLines={1} style={styles.distance}>
              {entry.distanceLabel}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: spacing.sm,
    zIndex: 50,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowStale: {
    opacity: 0.5,
  },
  avatarShell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  avatarSelf: {
    borderColor: colors.primaryHover,
  },
  avatar: {
    width: 31,
    height: 31,
    borderRadius: radius.pill,
  },
  initials: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  distancePill: {
    minWidth: 52,
    marginLeft: -5,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 5,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(10,10,14,0.94)',
  },
  distance: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
