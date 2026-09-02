import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaAvatar, NoxaButton, NoxaInput } from '@/src/components/ui';
import {
  isMissingColumnError,
  isSupportedProfileAvatarMimeType,
  maxProfileAvatarBytes,
  normalizeProfileAvatarMimeType,
  normalizeProfileUsername,
  saveProfileIdentity,
  type ProfileIdentityErrors,
  type ProfileIdentityValues,
} from '@/src/features/profile/profileIdentityPersistence';
import { useResponsive } from '@/src/hooks/useResponsive';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type OnboardingIdentitySetupProps = {
  onContinue: () => void;
};

const initialValues: ProfileIdentityValues = {
  displayName: '',
  username: '',
  city: '',
  countryCode: null,
};

function initials(value: string) {
  return (
    value
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NX'
  );
}

export function OnboardingIdentitySetup({ onContinue }: OnboardingIdentitySetupProps) {
  const { gutter, contentMaxWidth } = useResponsive();
  const [userId, setUserId] = useState<string | null>(null);
  const [values, setValues] = useState<ProfileIdentityValues>(initialValues);
  const [persistedUsername, setPersistedUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<ProfileIdentityErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadIdentity = useCallback(async () => {
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

    const username = normalizeProfileUsername(data?.username ?? '');
    setPersistedUsername(username || null);
    setValues({
      displayName: data?.display_name || String(user.user_metadata?.display_name ?? 'Driver'),
      username,
      city: data?.city ?? '',
      countryCode: (data as { country_code?: string | null } | null)?.country_code ?? null,
    });
    setAvatarUrl(data?.avatar_url ?? null);
    setAvatarAsset(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  const setDisplayName = (displayName: string) => {
    setValues((current) => ({ ...current, displayName }));
    setErrors((current) => ({ ...current, displayName: undefined, form: undefined }));
  };

  const setUsername = (username: string) => {
    if (persistedUsername) return;
    setValues((current) => ({ ...current, username }));
    setErrors((current) => ({ ...current, username: undefined, form: undefined }));
  };

  const chooseAvatar = async () => {
    if (isSaving || isLoading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrors((current) => ({ ...current, avatar: 'Allow photo access to choose an avatar.' }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mimeType = normalizeProfileAvatarMimeType(asset.mimeType);
    if (!isSupportedProfileAvatarMimeType(mimeType)) {
      setErrors((current) => ({ ...current, avatar: 'Choose a JPEG, PNG, WebP, HEIC, or HEIF image.' }));
      return;
    }

    if (asset.fileSize && asset.fileSize > maxProfileAvatarBytes) {
      setErrors((current) => ({ ...current, avatar: 'Avatar must be 5 MB or less.' }));
      return;
    }

    setAvatarAsset(asset);
    setErrors((current) => ({ ...current, avatar: undefined, form: undefined }));
  };

  const saveAndContinue = async () => {
    if (!userId || isSaving) return;

    const normalizedUsername = normalizeProfileUsername(values.username);
    if (!normalizedUsername) {
      setErrors((current) => ({ ...current, username: 'Choose a unique username to continue.' }));
      return;
    }

    setIsSaving(true);
    setErrors({});
    const result = await saveProfileIdentity({
      avatarAsset,
      currentAvatarUrl: avatarUrl,
      userId,
      values: { ...values, username: normalizedUsername },
    });
    setIsSaving(false);

    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }

    setPersistedUsername(normalizedUsername);
    setAvatarUrl(result.avatarUrl);
    setAvatarAsset(null);
    onContinue();
  };

  const previewUri = avatarAsset?.uri ?? avatarUrl;
  const normalizedUsername = normalizeProfileUsername(values.username);
  const usernameValid = normalizedUsername.length >= 3
    && normalizedUsername.length <= 20
    && /^[a-z0-9_]+$/.test(normalizedUsername);
  const canContinue = values.displayName.trim().length >= 2 && usernameValid;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
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

        <View style={styles.questionBlock}>
          <Text style={styles.eyebrow}>01 · IDENTITY</Text>
          <Text maxFontSizeMultiplier={1.35} style={styles.title}>
            Choose your NOXA identity.
          </Text>
          <Text style={styles.identityNote}>
            Your username is unique and becomes locked after setup. Your display name and photo can still be changed later.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.fields}>
              <NoxaInput
                autoCapitalize="words"
                editable={!isSaving}
                label="Display name"
                maxLength={40}
                onChangeText={setDisplayName}
                placeholder="Your name or nickname"
                value={values.displayName}
              />
              {errors.displayName ? <Text style={styles.errorText}>{errors.displayName}</Text> : null}

              <NoxaInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving && !persistedUsername}
                hint={persistedUsername ? 'Username locked to this account' : '3–20 characters · letters, numbers, underscore'}
                label="Username"
                maxLength={20}
                onBlur={() => setUsername(normalizeProfileUsername(values.username))}
                onChangeText={setUsername}
                placeholder="noxa_driver"
                value={values.username}
              />
              {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

              <Pressable
                accessibilityLabel="Choose profile photo"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void chooseAvatar()}
                style={({ pressed }) => [styles.photoRow, pressed && styles.pressed]}>
                <View style={styles.avatarRing}>
                  {previewUri ? (
                    <Image source={{ uri: previewUri }} style={styles.avatarImage} />
                  ) : (
                    <NoxaAvatar initials={initials(values.displayName)} size={54} />
                  )}
                </View>
                <View style={styles.photoCopy}>
                  <Text style={styles.photoLabel}>Profile photo</Text>
                  <Text style={styles.photoMeta}>Optional · technical placeholder is used until you add one</Text>
                </View>
                <Text style={styles.photoAction}>{previewUri ? 'Change' : 'Add photo'}</Text>
              </Pressable>
              {errors.avatar ? <Text style={styles.errorText}>{errors.avatar}</Text> : null}
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
    </KeyboardAvoidingView>
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
    width: '20%',
    height: 2,
    backgroundColor: colors.primary,
  },
  questionBlock: {
    marginTop: spacing.xxxl,
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
  identityNote: {
    maxWidth: 460,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
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
  photoRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarRing: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  photoCopy: {
    flex: 1,
    gap: 3,
  },
  photoLabel: {
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.row,
  },
  photoMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
  },
  photoAction: {
    color: colors.text,
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
