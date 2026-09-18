import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NoxaHeader, NoxaScreen } from '@/src/components/ui';
import {
  LEGAL_EFFECTIVE_DATE,
  NOXA_OPERATOR,
  SUPPORT_EMAIL,
  type LegalDocument,
} from '@/src/legal/legalDocuments';
import { colors, radius, spacing, typography } from '@/src/theme';

type LegalDocumentScreenProps = {
  document: LegalDocument;
};

export function LegalDocumentScreen({ document }: LegalDocumentScreenProps) {
  const contact = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`NOXA ${document.title}`)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Email unavailable', `Contact us at ${SUPPORT_EMAIL}.`);
    }
  };

  return (
    <NoxaScreen padded={false}>
      <View style={styles.shell}>
        <NoxaHeader
          left={
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          }
          title={document.title}
          subtitle={`Effective ${LEGAL_EFFECTIVE_DATE}`}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>{document.eyebrow}</Text>
            <Text style={styles.summary}>{document.summary}</Text>
            <View style={styles.datePill}>
              <Ionicons name="calendar-outline" size={14} color={colors.primaryHover} />
              <Text style={styles.dateText}>Effective {LEGAL_EFFECTIVE_DATE}</Text>
            </View>
          </View>

          {document.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>

              {section.paragraphs?.map((paragraph, index) => (
                <Text key={`${section.title}-paragraph-${index}`} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}

              {section.bullets?.map((bullet, index) => (
                <View key={`${section.title}-bullet-${index}`} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.contactCard}>
            <View style={styles.contactIcon}>
              <Ionicons name="mail-outline" size={21} color={colors.primaryHover} />
            </View>
            <View style={styles.contactCopy}>
              <Text style={styles.contactTitle}>Questions or requests?</Text>
              <Text style={styles.contactEmail}>{SUPPORT_EMAIL}</Text>
            </View>
            <Pressable
              accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
              accessibilityRole="link"
              onPress={() => void contact()}
              style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}>
              <Ionicons name="arrow-forward" size={18} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.footer}>NOXA · Operated by {NOXA_OPERATOR} · Greece</Text>
        </ScrollView>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  content: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  summary: {
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
  },
  datePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 30,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  section: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  paragraph: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 5,
    height: 5,
    marginTop: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryHover,
  },
  bulletText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  contactCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  contactIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: { flex: 1, minWidth: 0 },
  contactTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  contactEmail: { marginTop: 3, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  contactButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  footer: {
    paddingVertical: spacing.md,
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
