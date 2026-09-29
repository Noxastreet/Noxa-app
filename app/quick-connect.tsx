import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoxaScreen } from '@/src/components/ui';
import {
  createQuickConnectSession,
  formatQuickConnectCode,
  quickConnectQrPayload,
  quickConnectValueFromPayload,
  redeemQuickConnect,
  resolveQuickConnect,
  type QuickConnectFriend,
  type QuickConnectPreview,
  type QuickConnectSession,
} from '@/src/features/quick-connect/api';
import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type Mode = 'share' | 'connect';

type CurrentProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'NX';
}

function formatUsername(value: string | null) {
  if (!value) return null;
  return value.startsWith('@') ? value : `@${value}`;
}

function formatCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) return '05:00';
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  const seconds = Math.ceil(remaining / 1000);
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`;
}

function ProfileAvatar({
  name,
  uri,
  size = 54,
}: {
  name: string;
  uri: string | null;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={styles.avatarText}>{initials(name)}</Text>
      )}
    </View>
  );
}

export default function QuickConnectScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    value?: string | string[];
  }>();

  const initialMode = normalizeParam(params.mode) === 'connect' ? 'connect' : 'share';
  const incomingValue = normalizeParam(params.value)?.trim() || null;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [session, setSession] = useState<QuickConnectSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);

  const [codeInput, setCodeInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [preview, setPreview] = useState<QuickConnectPreview | null>(null);
  const [friend, setFriend] = useState<QuickConnectFriend | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const incomingHandledRef = useRef(false);

  const loadProfile = useCallback(async () => {
    const user = await getCurrentSessionUser();
    if (!user) return;

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url')
      .eq('id', user.id)
      .single();

    if (!profileError && data) setProfile(data as CurrentProfile);
  }, []);

  const refreshSession = useCallback(async () => {
    if (sessionLoading) return;
    setSessionLoading(true);
    setError(null);
    try {
      setSession(await createQuickConnectSession());
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'Quick Connect code could not be created.',
      );
    } finally {
      setSessionLoading(false);
    }
  }, [sessionLoading]);

  const resolveValue = useCallback(async (rawValue: string) => {
    const value = quickConnectValueFromPayload(rawValue).trim();
    if (!value) return;

    setResolving(true);
    setError(null);
    setPreview(null);
    setFriend(null);
    try {
      const nextPreview = await resolveQuickConnect(value);
      if (!nextPreview) {
        throw new Error('This Quick Connect code is invalid or expired.');
      }
      setPreview(nextPreview);
      setScannerOpen(false);
      setScannerLocked(false);
      setMode('connect');
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : 'Quick Connect code could not be verified.',
      );
      setScannerLocked(false);
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (mode !== 'share' || session || sessionLoading) return;
    void refreshSession();
  }, [mode, refreshSession, session, sessionLoading]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session || Date.parse(session.expiresAt) > now) return;
    setSession(null);
  }, [now, session]);

  useEffect(() => {
    if (!incomingValue || incomingHandledRef.current) return;
    incomingHandledRef.current = true;
    setMode('connect');
    void resolveValue(incomingValue);
  }, [incomingValue, resolveValue]);

  const formattedCode = session ? formatQuickConnectCode(session.code) : '';
  const qrValue = session ? quickConnectQrPayload(session.token) : '';
  const countdown = formatCountdown(session?.expiresAt ?? null, now);

  const canSubmitCode = useMemo(
    () => codeInput.replace(/[^A-Fa-f0-9]/g, '').length === 10,
    [codeInput],
  );

  const handleScan = useCallback((result: BarcodeScanningResult) => {
    if (scannerLocked || resolving) return;
    setScannerLocked(true);
    void resolveValue(result.data);
  }, [resolveValue, resolving, scannerLocked]);

  const openScanner = useCallback(async () => {
    setError(null);
    setPreview(null);
    setFriend(null);

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera permission is required to scan a Quick Connect QR code.');
        return;
      }
    }

    setScannerLocked(false);
    setScannerOpen(true);
  }, [permission?.granted, requestPermission]);

  const addFriend = useCallback(async () => {
    if (!preview || redeeming) return;
    if (preview.alreadyFriends) {
      router.replace({
        pathname: '/driver-profile/[id]',
        params: { id: preview.userId },
      });
      return;
    }

    setRedeeming(true);
    setError(null);
    try {
      const result = await redeemQuickConnect(preview.sessionId);
      setFriend(result);
      setPreview(null);
    } catch (redeemError) {
      setError(
        redeemError instanceof Error
          ? redeemError.message
          : 'Friend could not be added.',
      );
    } finally {
      setRedeeming(false);
    }
  }, [preview, redeeming]);

  const shareCode = useCallback(async () => {
    if (!session) return;
    await Share.share({
      message: `NOXA Quick Connect: ${formatQuickConnectCode(session.code)}. Valid for 5 minutes.`,
    });
  }, [session]);

  const resetConnect = useCallback(() => {
    setPreview(null);
    setFriend(null);
    setError(null);
    setCodeInput('');
    setScannerOpen(false);
    setScannerLocked(false);
  }, []);

  return (
    <NoxaScreen padded={false}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Close Quick Connect"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>NOXA SOCIAL</Text>
            <Text style={styles.title}>QUICK CONNECT</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.segment}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'share' }}
            onPress={() => {
              resetConnect();
              setMode('share');
            }}
            style={[styles.segmentButton, mode === 'share' && styles.segmentButtonActive]}>
            <Ionicons
              name="qr-code-outline"
              size={17}
              color={mode === 'share' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.segmentText, mode === 'share' && styles.segmentTextActive]}>
              MY CODE
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'connect' }}
            onPress={() => {
              resetConnect();
              setMode('connect');
            }}
            style={[styles.segmentButton, mode === 'connect' && styles.segmentButtonActive]}>
            <Ionicons
              name="person-add-outline"
              size={17}
              color={mode === 'connect' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.segmentText, mode === 'connect' && styles.segmentTextActive]}>
              ADD DRIVER
            </Text>
          </Pressable>
        </View>

        {mode === 'share' ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.shareIntro}>
              <Text style={styles.sectionEyebrow}>ONE-TIME HANDSHAKE</Text>
              <Text style={styles.heroTitle}>Show this to the driver next to you.</Text>
              <Text style={styles.heroBody}>
                The code expires in five minutes and works once. No location is shared.
              </Text>
            </View>

            <View style={styles.identityRow}>
              <ProfileAvatar
                name={profile?.display_name ?? 'NOXA Driver'}
                uri={profile?.avatar_url ?? null}
                size={48}
              />
              <View style={styles.identityCopy}>
                <Text numberOfLines={1} style={styles.identityName}>
                  {profile?.display_name ?? 'NOXA Driver'}
                </Text>
                {formatUsername(profile?.username ?? null) ? (
                  <Text style={styles.identityMeta}>
                    {formatUsername(profile?.username ?? null)}
                  </Text>
                ) : (
                  <Text style={styles.identityMeta}>Your NOXA profile</Text>
                )}
              </View>
              <View style={styles.timerPill}>
                <Ionicons name="time-outline" size={14} color={colors.primaryHover} />
                <Text style={styles.timerText}>{countdown}</Text>
              </View>
            </View>

            <View style={styles.qrCard}>
              {session && qrValue ? (
                <View style={styles.qrSurface}>
                  <QRCode
                    value={qrValue}
                    size={212}
                    backgroundColor="#FFFFFF"
                    color="#09090C"
                    quietZone={10}
                  />
                </View>
              ) : sessionLoading ? (
                <ActivityIndicator color={colors.primary} size="large" />
              ) : (
                <Ionicons name="qr-code-outline" size={72} color={colors.textSubtle} />
              )}

              <Text style={styles.codeLabel}>QUICK CONNECT CODE</Text>
              <Text selectable style={styles.codeValue}>
                {formattedCode || '---- ---- --'}
              </Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionRow}>
              <Pressable
                disabled={sessionLoading}
                onPress={() => {
                  setSession(null);
                  void refreshSession();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                  sessionLoading && styles.disabled,
                ]}>
                <Ionicons name="refresh" size={18} color={colors.text} />
                <Text style={styles.secondaryButtonText}>NEW CODE</Text>
              </Pressable>
              <Pressable
                disabled={!session}
                onPress={() => void shareCode()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  !session && styles.disabled,
                ]}>
                <Ionicons name="share-outline" size={18} color={colors.text} />
                <Text style={styles.primaryButtonText}>SHARE</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.connectContent}>
            {friend ? (
              <View style={styles.successState}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={30} color={colors.text} />
                </View>
                <Text style={styles.sectionEyebrow}>CONNECTED</Text>
                <Text style={styles.heroTitle}>{friend.displayName} is now your friend.</Text>
                <Text style={styles.heroBody}>
                  They are immediately available in Drive Together.
                </Text>
                <View style={styles.previewCard}>
                  <ProfileAvatar
                    name={friend.displayName}
                    uri={friend.avatarUrl}
                    size={58}
                  />
                  <View style={styles.identityCopy}>
                    <Text style={styles.previewName}>{friend.displayName}</Text>
                    {friend.username ? (
                      <Text style={styles.previewMeta}>{formatUsername(friend.username)}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: '/driver-profile/[id]',
                      params: { id: friend.userId },
                    })
                  }
                  style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>OPEN PROFILE</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={resetConnect}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonText}>ADD ANOTHER DRIVER</Text>
                </Pressable>
              </View>
            ) : preview ? (
              <View style={styles.previewState}>
                <Text style={styles.sectionEyebrow}>CONFIRM DRIVER</Text>
                <Text style={styles.heroTitle}>Add this person to your NOXA friends?</Text>
                <View style={styles.previewCard}>
                  <ProfileAvatar
                    name={preview.displayName}
                    uri={preview.avatarUrl}
                    size={64}
                  />
                  <View style={styles.identityCopy}>
                    <Text style={styles.previewName}>{preview.displayName}</Text>
                    {preview.username ? (
                      <Text style={styles.previewMeta}>{formatUsername(preview.username)}</Text>
                    ) : (
                      <Text style={styles.previewMeta}>NOXA driver</Text>
                    )}
                    <Text style={styles.previewStatus}>
                      {preview.alreadyFriends ? 'Already friends' : 'Ready to connect'}
                    </Text>
                  </View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  disabled={redeeming}
                  onPress={() => void addFriend()}
                  style={({ pressed }) => [
                    styles.primaryWideButton,
                    pressed && !redeeming && styles.pressed,
                    redeeming && styles.disabled,
                  ]}>
                  {redeeming ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <>
                      <Ionicons
                        name={preview.alreadyFriends ? 'person-circle-outline' : 'person-add'}
                        size={18}
                        color={colors.text}
                      />
                      <Text style={styles.primaryButtonText}>
                        {preview.alreadyFriends ? 'OPEN PROFILE' : 'ADD FRIEND'}
                      </Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={resetConnect}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonText}>USE ANOTHER CODE</Text>
                </Pressable>
              </View>
            ) : scannerOpen ? (
              <View style={styles.scannerState}>
                <View style={styles.scannerHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>SCAN QR</Text>
                    <Text style={styles.scannerTitle}>Point at a NOXA code.</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close scanner"
                    onPress={() => {
                      setScannerOpen(false);
                      setScannerLocked(false);
                    }}
                    style={styles.iconButton}>
                    <Ionicons name="close" size={20} color={colors.text} />
                  </Pressable>
                </View>
                <View style={styles.cameraCard}>
                  <CameraView
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scannerLocked ? undefined : handleScan}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={styles.scanOverlay}>
                    <View style={styles.scanFrame} />
                  </View>
                  {resolving ? (
                    <View style={styles.cameraLoading}>
                      <ActivityIndicator color={colors.text} size="large" />
                    </View>
                  ) : null}
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}>
                <View style={styles.shareIntro}>
                  <Text style={styles.sectionEyebrow}>IN-PERSON CONNECT</Text>
                  <Text style={styles.heroTitle}>Scan a driver. Add once. Drive later.</Text>
                  <Text style={styles.heroBody}>
                    Scan their temporary QR or enter the code shown on their phone.
                  </Text>
                </View>

                <Pressable
                  onPress={() => void openScanner()}
                  style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}>
                  <View style={styles.scanIcon}>
                    <Ionicons name="scan-outline" size={28} color={colors.text} />
                  </View>
                  <View style={styles.scanCopy}>
                    <Text style={styles.scanTitle}>SCAN QR CODE</Text>
                    <Text style={styles.scanMeta}>Fastest when both phones are together</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.textSubtle} />
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>OR ENTER CODE</Text>
                  <View style={styles.divider} />
                </View>

                <View style={styles.codeEntry}>
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={12}
                    onChangeText={(value) => setCodeInput(formatQuickConnectCode(value))}
                    onSubmitEditing={() => {
                      if (canSubmitCode) void resolveValue(codeInput);
                    }}
                    placeholder="AB12-CD34-EF"
                    placeholderTextColor={colors.textSubtle}
                    returnKeyType="go"
                    selectionColor={colors.primary}
                    style={styles.codeInput}
                    value={codeInput}
                  />
                  <Pressable
                    disabled={!canSubmitCode || resolving}
                    onPress={() => void resolveValue(codeInput)}
                    style={[
                      styles.codeGoButton,
                      (!canSubmitCode || resolving) && styles.disabled,
                    ]}>
                    {resolving ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : (
                      <Ionicons name="arrow-forward" size={20} color={colors.text} />
                    )}
                  </Pressable>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={styles.privacyCard}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.privacyText}>
                    Quick Connect does not expose your location, phone number or email.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    padding: 4,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.button,
  },
  segmentButtonActive: {
    backgroundColor: colors.surfaceRaised,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  segmentTextActive: {
    color: colors.text,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 52,
    gap: spacing.lg,
  },
  connectContent: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  shareIntro: {
    gap: spacing.xs,
  },
  sectionEyebrow: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.55,
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  identityRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  avatarText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  identityMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  timerText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  qrCard: {
    minHeight: 340,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.hero,
    backgroundColor: '#111116',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  qrSurface: {
    padding: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  codeLabel: {
    marginTop: spacing.xs,
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  codeValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  scannerState: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  scannerHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scannerTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  cameraCard: {
    flex: 1,
    minHeight: 360,
    overflow: 'hidden',
    borderRadius: radius.hero,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  scanFrame: {
    width: 235,
    height: 235,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  scanButton: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  scanIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  scanCopy: {
    flex: 1,
  },
  scanTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  scanMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  dividerText: {
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  codeEntry: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 7,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  codeInput: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  codeGoButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  previewState: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  successState: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  successIcon: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: colors.primary,
  },
  previewCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  previewName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  previewMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },
  previewStatus: {
    marginTop: 6,
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  primaryWideButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  textButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textButtonText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  privacyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  error: {
    color: colors.primaryHover,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.42,
  },
});
