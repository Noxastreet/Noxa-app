import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { LinearTransition, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

import { NoxaAvatar } from '@/src/components/ui';
import type { ParticipantStackPresentation, ParticipantStackRow } from '@/src/features/group-drive/runtime';
import { animations, colors, radius } from '@/src/theme';

type GroupDriveParticipantStackProps = {
  presentation: ParticipantStackPresentation;
  selectedUserId?: string | null;
  onSelectParticipant?: (userId: string) => void;
  onUnavailableParticipant?: (userId: string) => void;
  onOpenParticipants?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const reorderTransition = LinearTransition
  .duration(320)
  .reduceMotion(ReduceMotion.System);

function ParticipantOrb({
  onPress,
  row,
  selected,
}: {
  onPress: () => void;
  row: ParticipantStackRow;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const statusStyle = row.kind === 'arrived'
    ? styles.statusArrived
    : row.kind === 'distance'
      ? styles.statusLive
      : styles.statusUnavailable;

  return (
    <Animated.View layout={reorderTransition}>
      <Pressable
        accessibilityLabel={row.accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        hitSlop={4}
        onPress={onPress}
        style={({ pressed }) => [
          styles.touchTarget,
          pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
        ]}
        testID={`group-drive-participant-${row.userId}`}
      >
        <View style={[
          styles.avatarShell,
          row.isCurrentUser && styles.currentUserShell,
          selected && styles.selectedShell,
        ]}>
          <NoxaAvatar imageUrl={row.avatarUrl} initials={row.initials} size={34} />
          <View style={[styles.statusDot, statusStyle]} />
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.distanceLabel,
            row.kind === 'arrived' && styles.distanceLabelArrived,
            row.kind === 'unavailable' && styles.distanceLabelUnavailable,
          ]}
        >
          {row.kind === 'unavailable' ? '—' : row.valueLabel}
        </Text>
        {row.isCurrentUser ? <Text style={styles.youLabel}>YOU</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export const GroupDriveParticipantStack = memo(function GroupDriveParticipantStack({
  onOpenParticipants,
  onSelectParticipant,
  onUnavailableParticipant,
  presentation,
  selectedUserId,
  style,
  testID = 'group-drive-participant-stack',
}: GroupDriveParticipantStackProps) {
  const reduceMotion = useReducedMotion();

  return (
    <View accessibilityLabel="Group Drive participants" style={[styles.stack, style]} testID={testID}>
      {presentation.rows.map((row) => (
        <ParticipantOrb
          key={row.userId}
          row={row}
          selected={selectedUserId === row.userId}
          onPress={() => {
            if (row.canFocus) onSelectParticipant?.(row.userId);
            else onUnavailableParticipant?.(row.userId);
          }}
        />
      ))}
      {presentation.hiddenCount > 0 ? (
        <Animated.View layout={reorderTransition}>
          <Pressable
            accessibilityLabel={presentation.moreAccessibilityLabel ?? undefined}
            accessibilityRole="button"
            onPress={onOpenParticipants}
            style={({ pressed }) => [
              styles.more,
              pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
            ]}
            testID="group-drive-participant-more"
          >
            <Text style={styles.moreLabel}>+{presentation.hiddenCount}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  stack: {
    alignSelf: 'flex-start',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,6,10,0.68)',
  },
  touchTarget: {
    width: 48,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarShell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBase,
  },
  currentUserShell: {
    borderColor: colors.borderStrong,
  },
  selectedShell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.surfaceBase,
  },
  statusLive: {
    backgroundColor: colors.success,
  },
  statusArrived: {
    backgroundColor: colors.primary,
  },
  statusUnavailable: {
    backgroundColor: colors.textSubtle,
  },
  distanceLabel: {
    maxWidth: 60,
    marginTop: 3,
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  distanceLabelArrived: {
    color: colors.primaryHover,
  },
  distanceLabelUnavailable: {
    color: colors.textSubtle,
  },
  youLabel: {
    position: 'absolute',
    top: -3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.text,
    backgroundColor: colors.surfaceBase,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  more: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  moreLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: animations.pressedScale }],
  },
  pressedReduced: {
    opacity: 0.82,
  },
});
