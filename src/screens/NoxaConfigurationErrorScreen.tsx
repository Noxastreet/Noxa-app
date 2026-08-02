import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { ClientEnvStatus } from '@/src/config/env';
import { colors, radius, spacing } from '@/src/theme';

type NoxaConfigurationErrorScreenProps = {
  status: ClientEnvStatus;
  onLayoutReady: () => void;
};

function VariableList({
  label,
  names,
}: {
  label: string;
  names: readonly string[];
}) {
  if (names.length === 0) {
    return null;
  }

  return (
    <View style={styles.issueGroup}>
      <Text style={styles.issueLabel}>{label}</Text>
      {names.map((name) => (
        <View key={name} style={styles.variableRow}>
          <Text selectable style={styles.variableName}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function NoxaConfigurationErrorScreen({
  status,
  onLayoutReady,
}: NoxaConfigurationErrorScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} onLayout={onLayoutReady}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>N</Text>
        </View>

        <Text style={styles.eyebrow}>NOXA CONFIGURATION</Text>
        <Text style={styles.title}>Environment setup required</Text>
        <Text style={styles.description}>
          NOXA stopped before loading navigation because required public client
          configuration is missing or invalid.
        </Text>

        <View style={styles.card}>
          <VariableList label="Missing" names={status.missing} />
          <VariableList label="Invalid" names={status.invalid} />

          <View style={styles.divider} />

          <Text style={styles.step}>
            1. Copy <Text style={styles.code}>.env.example</Text> to{' '}
            <Text style={styles.code}>.env.local</Text>.
          </Text>
          <Text style={styles.step}>
            2. Add the three public client values.
          </Text>
          <Text style={styles.step}>
            3. Restart Metro with{' '}
            <Text style={styles.code}>
              npx expo start --dev-client --tunnel -c
            </Text>
            .
          </Text>
        </View>

        <Text style={styles.warning}>
          Never use a Supabase service-role key, a secret API key, or another
          private credential in an EXPO_PUBLIC_ variable.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  brandMark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  brandLetter: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -2,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    maxWidth: 340,
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  description: {
    maxWidth: 420,
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  issueGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  issueLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  variableRow: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  variableName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
    backgroundColor: colors.border,
  },
  step: {
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  code: {
    color: colors.text,
    fontWeight: '700',
  },
  warning: {
    maxWidth: 480,
    marginTop: spacing.lg,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
});
