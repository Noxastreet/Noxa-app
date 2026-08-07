import { Ionicons } from '@expo/vector-icons';
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
  isSupportedProfileAvatarMimeType,
  maxProfileAvatarBytes,
  normalizeProfileAvatarMimeType,
  normalizeProfileUsername,
  saveProfileIdentity,
  type ProfileIdentityErrors,
  type ProfileIdentityValues,
} from '@/src/features/profile/profileIdentityPersistence';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type OnboardingIdentitySetupProps = {
  onContinue: () => void;
  onSkip: () => void;
};

const initialValues: ProfileIdentityValues = {
  displayName: '',
  username: '',
  city: '',
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

export function OnboardingIdentitySetup({ onContinue, onSkip }: OnboardingIdentitySetupProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [values, setValues] = useState<ProfileIdentityValues>(initialValues);
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
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name,username,city,avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setErrors({ form: 'Profile could not be loaded. You can skip this step and edit it later.' });
      setValues({
        displayName: String(user.user_metadata?.display_name ?? 'Driver'),
        username: '',
        city: '',
      });
      setIsLoading(false);
      return;
    }

    setValues({
      displayName: data?.display_name || String(user.user_metadata?.display_name ?? 'Driver'),
      username: data?.username ?? '',
      city: data?.city ?? '',
    });
    setAvatarUrl(data?.avatar_url ?? null);
    setAvatarAsset(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  const setField = (field: keyof ProfileIdentityValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
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

    setIsSaving(true);
    setErrors({});
    const result = await saveProfileIdentity({
      avatarAsset,
      currentAvatarUrl: avatarUrl,
      userId,
      values: {
        ...values,
        username: normalizeProfileUsername(values.username),
      },
    });
    setIsSaving(false);

    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }

    setAvatarUrl(result.avatarUrl);
    setAvatarAsset(null);
    onContinue();
  };

  const previewUri = avatarAsset?.uri ?? avatarUrl;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>YOUR NOXA IDENTITY</Text>
          <Text style={styles.title}>MAKE IT YOURS</Text>
          <Text style={styles.subtitle}>A few details help drivers recognize you. You can change everything later.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.helper}>Loading your profile…</Text>
          </View>
        ) : (
          <>
            <View style={styles.avatarSection}>
              <Pressable
                accessibilityLabel="Choose profile photo"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void chooseAvatar()}
                style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
                <View style={styles.avatarRing}>
                  {previewUri ? (
                    <Image source={{ uri: previewUri }} style={styles.avatarImage} />
                  ) : (
                    <NoxaAvatar initials={initials(values.displayName)} size={82} />
                  )}
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={15} color={colors.text} />
                  </View>
                </View>
              </Pressable>
              <View style={styles.avatarCopy}>
                <Text style={styles.avatarTitle}>Profile photo</Text>
                <Text style={styles.helper}>Optional · square image · up to 5 MB</Text>
              </View>
            </View>
            {errors.avatar ? <Text style={styles.errorText}>{errors.avatar}</Text> : null}

            <View style={styles.fields}>
              <View style={styles.fieldWrap}>
                <NoxaInput
                  autoCapitalize="words"
                  editable={!isSaving}
                  label="Display name"
                  maxLength={40}
                  onChangeText={(value) => setField('displayName', value)}
                  placeholder="Your name or nickname"
                  value={values.displayName}
                />
                {errors.displayName ? <Text style={styles.errorText}>{errors.displayName}</Text> : null}
              </View>

              <View style={styles.fieldWrap}>
                <NoxaInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSaving}
                  label="Username · optional"
                  maxLength={21}
                  onBlur={() => setField('username', normalizeProfileUsername(values.username))}
                  onChangeText={(value) => setField('username', value)}
                  placeholder="noxa_driver"
                  value={values.username}
                />
                <Text style={styles.helper}>Used as your public @handle.</Text>
                {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
              </View>

              <View style={styles.fieldWrap}>
                <NoxaInput
                  autoCapitalize="words"
                  editable={!isSaving}
                  label="City · optional"
                  maxLength={60}
                  onChangeText={(value) => setField('city', value)}
                  placeholder="Thessaloniki"
                  value={values.city}
                />
                <Text style={styles.helper}>City only — never your precise address.</Text>
                {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
              </View>
            </View>

            {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

            <View style={styles.actions}>
              <NoxaButton
                disabled={!userId || isSaving}
                fullWidth
                loading={isSaving}
                onPress={() => void saveAndContinue()}
                title="CONTINUE"
              />
              <Pressable accessibilityRole="button" disabled={isSaving} onPress={onSkip} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
                <Text style={styles.skipText}>SKIP FOR NOW</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  progressTrack: { height: 2, backgroundColor: colors.divider },
  progressFill: { width: '72%', height: 2, backgroundColor: colors.primary },
  heading: { gap: spacing.xs },
  eyebrow: { color: colors.primaryHover, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 32, fontWeight: '900', lineHeight: 35 },
  subtitle: { maxWidth: 330, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', lineHeight: 19 },
  loadingState: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  avatarSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarButton: { borderRadius: radius.pill },
  avatarRing: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  avatarImage: { width: 82, height: 82, borderRadius: radius.pill },
  cameraBadge: { position: 'absolute', right: 0, bottom: 1, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.background },
  avatarCopy: { flex: 1, gap: 3 },
  avatarTitle: { color: colors.text, fontSize: typography.body, fontWeight: '900' },
  fields: { gap: spacing.md },
  fieldWrap: { gap: spacing.xs },
  helper: { color: colors.textSubtle, fontSize: 10, fontWeight: '700', lineHeight: 15 },
  errorText: { color: colors.primaryHover, fontSize: typography.caption, fontWeight: '800' },
  formError: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle, borderWidth: 1, borderColor: colors.borderAccent, color: colors.text, fontSize: typography.caption, fontWeight: '800' },
  actions: { marginTop: 'auto', gap: spacing.sm },
  skipButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
