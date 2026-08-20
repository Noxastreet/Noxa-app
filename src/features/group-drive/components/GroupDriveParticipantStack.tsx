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
import { animations, colors, radius, spacing, typography } from '@/src/theme';

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

function ParticipantRow({
  onPress,
  row,
  selected,
}: {
  onPress: () => void;
  row: ParticipantStackRow;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View layout={reorderTransition}>
      <Pressable
        accessibilityLabel={row.accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          row.isCurrentUser && styles.currentUserRow,
          pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
        ]}
        testID={`group-drive-participant-${row.userId}`}
      >
        <View style={[styles.avatarRing, selected && styles.avatarRingSelected]}>
          <NoxaAvatar imageUrl={row.avatarUrl} initials={row.initials} size={40} />
        </View>
        <View style={styles.labelWrap}>
          {row.isCurrentUser ? <Text style={styles.youLabel}>You</Text> : null}
          <Text
            numberOfLines={1}
            style={[styles.valueLabel, row.kind === 'unavailable' && styles.unavailableLabel]}
          >
            {row.valueLabel}
          </Text>
        </View>
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
        <ParticipantRow
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
    gap: spacing.xs,
  },
  row: {
    minHeight: 44,
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 2,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBase,
  },
  currentUserRow: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  labelWrap: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  youLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  valueLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.caption,
    lineHeight: typography.lineHeight.caption,
  },
  unavailableLabel: {
    color: colors.textMuted,
  },
  more: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  moreLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: animations.pressedScale }],
  },
  pressedReduced: {
    opacity: 0.82,
  },
});
