import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/src/theme';

type NoxaAvatarProps = {
  imageUrl?: string | null;
  initials?: string;
  size?: number;
};

export function NoxaAvatar({ imageUrl, initials = 'NX', size = 48 }: NoxaAvatarProps) {
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
        <Text style={[styles.initials, { fontSize: Math.max(typography.caption, size * 0.32) }]}>
          {initials.slice(0, 2).toUpperCase()}
        </Text>
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
  initials: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
