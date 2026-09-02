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
        <View style={styles.fallback}>
          <Text
            style={[
              styles.initials,
              {
                fontSize: Math.max(13, size * 0.29),
                letterSpacing: size >= 64 ? 0.8 : 0.3,
              },
            ]}
          >
            {compactLabel}
          </Text>
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  initials: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontWeight: '900',
  },
});