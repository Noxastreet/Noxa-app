import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/src/theme';

type NoxaAvatarProps = {
  imageUrl?: string | null;
  initials?: string;
  size?: number;
};

export function NoxaAvatar({ imageUrl, initials = 'NX', size = 48 }: NoxaAvatarProps) {
  const compactLabel = initials.slice(0, 2).toUpperCase() || 'NX';

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}> 
      {imageUrl ? (
        <Image
          contentFit="cover"
          source={{ uri: imageUrl }}
          style={[styles.image, { borderRadius: size / 2 }]}
          transition={120}
        />
      ) : (
        <View style={styles.technicalFallback}>
          <View style={[styles.axis, styles.axisHorizontal]} />
          <View style={[styles.axis, styles.axisVertical]} />
          <View style={styles.technicalCore}>
            <Ionicons name="person-outline" size={Math.max(16, size * 0.34)} color={colors.textMuted} />
          </View>
          <Text style={[styles.technicalLabel, { fontSize: Math.max(7, size * 0.16) }]}>{compactLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  technicalFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  technicalCore: {
    width: '56%',
    height: '56%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  axis: {
    position: 'absolute',
    backgroundColor: colors.border,
  },
  axisHorizontal: {
    left: '14%',
    right: '14%',
    height: StyleSheet.hairlineWidth,
  },
  axisVertical: {
    top: '14%',
    bottom: '14%',
    width: StyleSheet.hairlineWidth,
  },
  technicalLabel: {
    position: 'absolute',
    right: '12%',
    bottom: '9%',
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.display,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
