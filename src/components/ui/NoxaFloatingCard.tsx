import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AccessibilityState,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadows, spacing } from '@/src/theme';

export type NoxaFloatingCardActionVariant = 'solid' | 'outline' | 'active';

export type NoxaFloatingCardAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: NoxaFloatingCardActionVariant;
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  activeOpacity?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

type NoxaFloatingCardProps = {
  kicker?: string;
  title: string;
  titleNumberOfLines?: number;
  subtitle?: string;
  headerContent?: ReactNode;
  headerAccessory?: ReactNode;
  headerAlignItems?: 'flex-start' | 'center';
  headerGap?: number;
  onClose?: () => void;
  closeAccessibilityLabel?: string;
  closeButtonSize?: number;
  closeIconColor?: string;
  primaryAction?: NoxaFloatingCardAction;
  secondaryAction?: NoxaFloatingCardAction;
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
};

const ACTION_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };
const CLOSE_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

function ActionButton({ action, isPrimary }: { action: NoxaFloatingCardAction; isPrimary: boolean }) {
  const variant = action.variant ?? (isPrimary ? 'solid' : 'outline');
  return (
    <TouchableOpacity
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled, ...action.accessibilityState }}
      activeOpacity={action.activeOpacity ?? 0.82}
      disabled={action.disabled}
      hitSlop={ACTION_HIT_SLOP}
      onPress={action.onPress}
      style={[
        styles.action,
        styles[`action_${variant}`],
        isPrimary ? styles.actionFlex : styles.actionFull,
        action.disabled && styles.actionDisabled,
        action.style,
      ]}
    >
      {action.icon}
      <Text
        style={[
          styles.actionText,
          styles[`actionText_${variant}`],
          action.disabled && styles.actionTextDisabled,
          action.textStyle,
        ]}
      >
        {action.label}
      </Text>
    </TouchableOpacity>
  );
}

export function NoxaFloatingCard({
  kicker,
  title,
  titleNumberOfLines,
  subtitle,
  headerContent,
  headerAccessory,
  headerAlignItems = 'center',
  headerGap = spacing.md,
  onClose,
  closeAccessibilityLabel,
  closeButtonSize = 44,
  closeIconColor = colors.textMuted,
  primaryAction,
  secondaryAction,
  children,
  style,
}: NoxaFloatingCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.header, { alignItems: headerAlignItems, gap: headerGap }]}>
        <View style={styles.headerCopy}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={styles.title} numberOfLines={titleNumberOfLines}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {headerContent}
        </View>
        <View style={styles.headerActions}>
          {headerAccessory}
          {onClose ? (
            <TouchableOpacity
              accessibilityLabel={closeAccessibilityLabel ?? 'Close'}
              accessibilityRole="button"
              activeOpacity={0.78}
              hitSlop={CLOSE_HIT_SLOP}
              onPress={onClose}
              style={[
                styles.closeButton,
                { width: closeButtonSize, height: closeButtonSize },
              ]}
            >
              <Ionicons name="close" size={18} color={closeIconColor} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {children}

      {primaryAction && secondaryAction ? (
        <View style={styles.actionRow}>
          <ActionButton action={primaryAction} isPrimary />
          <ActionButton action={secondaryAction} isPrimary={false} />
        </View>
      ) : primaryAction ? (
        <View style={styles.actionSingle}>
          <ActionButton action={primaryAction} isPrimary />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  actionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionSingle: {
    marginTop: spacing.md,
  },
  action: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionFlex: {
    flex: 1,
  },
  actionFull: {
    width: '100%',
  },
  action_solid: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  action_outline: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  action_active: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primary,
  },
  actionDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    opacity: 0.55,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionText_solid: { color: colors.text },
  actionText_outline: { color: colors.text },
  actionText_active: { color: colors.text },
  actionTextDisabled: {
    color: colors.textSubtle,
  },
});
