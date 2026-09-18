import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoxaCompactLogo } from '@/src/components/brand';
import { colors, spacing, typography } from '@/src/theme';

type NoxaAuthScreenProps = {
  children: ReactNode;
  footer?: ReactNode;
  onBack: () => void;
  subtitle: string;
  title: string;
};

export function NoxaAuthScreen({ children, footer, onBack, subtitle, title }: NoxaAuthScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, spacing.md) + spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg,
            },
          ]}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <Ionicons color={colors.primaryHover} name="chevron-back" size={22} />
            </Pressable>
            <NoxaCompactLogo size="sm" />
          </View>

          <View style={styles.body}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  titleBlock: {
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.value,
    fontWeight: '900',
  },
  subtitle: {
    maxWidth: 420,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
