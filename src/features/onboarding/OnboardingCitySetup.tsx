import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaButton } from '@/src/components/ui';
import { CityField } from '@/src/features/city-picker';
import { CountryField } from '@/src/features/country-picker';
import {
  isMissingColumnError,
  saveProfileIdentity,
  type ProfileIdentityErrors,
  type ProfileIdentityValues,
} from '@/src/features/profile/profileIdentityPersistence';
import { useResponsive } from '@/src/hooks/useResponsive';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type OnboardingCitySetupProps = {
  onBack: () => void;
  onContinue: () => void;
};

const initialValues: ProfileIdentityValues = {
  displayName: '',
  username: '',
  city: '',
  countryCode: null,
};

export function OnboardingCitySetup({ onBack, onContinue }: OnboardingCitySetupProps) {
  const { gutter, contentMaxWidth } = useResponsive();
  const [userId, setUserId] = useState<string | null>(null);
  const [values, setValues] = useState<ProfileIdentityValues>(initialValues);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProfileIdentityErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrors({});

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;

    if (authError || !user) {
      setErrors({ form: 'Sign in to continue onboarding.' });
      setIsLoading(false);
      return;
    }

    setUserId(user.id);
    let { data, error } = await supabase
      .from('profiles')
      .select('display_name,username,city,avatar_url,country_code')
      .eq('id', user.id)
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase
        .from('profiles')
        .select('display_name,username,city,avatar_url')
        .eq('id', user.id)
        .maybeSingle());
    }

    if (error) {
      setErrors({ form: 'Profile could not be loaded. Please try again.' });
      setIsLoading(false);
      return;
    }

    setValues({
      displayName: data?.display_name || String(user.user_metadata?.display_name ?? 'Driver'),
      username: data?.username ?? '',
      city: data?.city ?? '',
      countryCode: (data as { country_code?: string | null } | null)?.country_code ?? null,
    });
    setAvatarUrl(data?.avatar_url ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const setCountryCode = (countryCode: string | null) => {
    setValues((current) =>
      current.countryCode === countryCode ? current : { ...current, countryCode, city: '' },
    );
    setErrors((current) => ({
      ...current,
      countryCode: undefined,
      city: undefined,
      form: undefined,
    }));
  };

  const setCity = (city: string) => {
    setValues((current) => ({ ...current, city }));
    setErrors((current) => ({ ...current, city: undefined, form: undefined }));
  };

  const saveAndContinue = async () => {
    if (!userId || isSaving) return;

    setIsSaving(true);
    setErrors({});
    const result = await saveProfileIdentity({
      avatarAsset: null,
      currentAvatarUrl: avatarUrl,
      userId,
      values,
    });
    setIsSaving(false);

    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }

    onContinue();
  };

  const canContinue = Boolean(values.countryCode && values.city.trim());

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: gutter, maxWidth: contentMaxWidth },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <Pressable
          accessibilityLabel="Back to identity"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <View style={styles.backOrb}>
            <Ionicons color={colors.textMuted} name="arrow-back" size={17} />
          </View>
        </Pressable>

        <View style={styles.questionBlock}>
          <Text style={styles.eyebrow}>02 · CITY</Text>
          <Text maxFontSizeMultiplier={1.35} style={styles.title}>
            Where do you drive?
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.fields}>
              <View style={styles.fieldWrap}>
                <CountryField
                  disabled={isSaving}
                  label="Country"
                  onChange={setCountryCode}
                  value={values.countryCode}
                />
                {errors.countryCode ? <Text style={styles.errorText}>{errors.countryCode}</Text> : null}
              </View>

              <View style={styles.fieldWrap}>
                <CityField
                  countryCode={values.countryCode}
                  disabled={isSaving}
                  label="City"
                  onChange={setCity}
                  value={values.city}
                />
                <Text style={styles.helper}>City only — never your precise address.</Text>
                {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
              </View>
            </View>

            {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

            <View style={styles.footer}>
              <NoxaButton
                disabled={!userId || isSaving || !canContinue}
                fullWidth
                loading={isSaving}
                onPress={() => void saveAndContinue()}
                style={styles.primaryButton}
                title="Continue"
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    paddingTop: 56,
    paddingBottom: 44,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.divider,
  },
  progressFill: {
    width: '40%',
    height: 2,
    backgroundColor: colors.primary,
  },
  backButton: {
    width: 44,
    height: 44,
    marginTop: spacing.lg,
    marginLeft: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOrb: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  questionBlock: {
    marginTop: spacing.md,
    gap: 14,
  },
  eyebrow: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontWeight: '600',
    ...typography.v2.label,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    ...typography.v2.hero,
  },
  loadingState: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fields: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  fieldWrap: { gap: spacing.xs },
  helper: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
  },
  errorText: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
  },
  formError: {
    marginTop: spacing.md,
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
  primaryButton: {
    minHeight: 56,
  },
  pressed: { opacity: 0.72 },
});
