import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
} from 'react-native-reanimated';

import { animations, colors, radius, spacing, typography } from '@/src/theme';

const EMPTY_STATE_ENTER = FadeIn
  .duration(animations.step)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: 8 }],
  })
  .reduceMotion(ReduceMotion.System);

type NoxaEmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

export function NoxaEmptyState({ icon, title, body }: NoxaEmptyStateProps) {
  return (
    <Animated.View entering={EMPTY_STATE_ENTER} style={styles.emptyState}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  iconWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.v2.section.fontSize,
    lineHeight: typography.v2.section.lineHeight,
    letterSpacing: typography.v2.section.letterSpacing,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    maxWidth: 300,
    color: colors.textMuted,
    fontSize: typography.v2.body.fontSize,
    lineHeight: typography.v2.body.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
});
