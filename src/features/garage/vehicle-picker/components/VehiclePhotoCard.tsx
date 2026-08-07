import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, radius, shadows, spacing, typography } from '@/src/theme';
import type { SupportedVehicleType } from '@/src/data/vehicleCatalogRegistry';
import { pickerMotion } from '../motion';
import { VehicleTypeIcon } from './VehicleTypeIcon';

type VehiclePhotoCardProps = {
  disabled?: boolean;
  onChoose: () => void;
  onRemove: () => void;
  photoUri: string | null;
  vehicleType: SupportedVehicleType;
};

export function VehiclePhotoCard({ disabled = false, onChoose, onRemove, photoUri, vehicleType }: VehiclePhotoCardProps) {
  return (
    <Animated.View layout={pickerMotion.layout} style={styles.root} testID="vehicle-picker:photo:cover">
      <View style={styles.preview}>
        {photoUri ? (
          <Animated.Image
            entering={pickerMotion.contentEnter}
            exiting={pickerMotion.contentExit}
            source={{ uri: photoUri }}
            style={styles.image}
          />
        ) : (
          <Animated.View
            entering={pickerMotion.contentEnter}
            exiting={pickerMotion.contentExit}
            style={styles.placeholder}>
            <VehicleTypeIcon vehicleType={vehicleType} size={46} color={colors.primaryHover} />
            <Text style={styles.placeholderTitle}>YOUR VEHICLE</Text>
            <Text style={styles.placeholderCopy}>A cover photo is optional.</Text>
          </Animated.View>
        )}
        <View style={styles.scrim} />
        {photoUri ? (
          <Animated.View entering={pickerMotion.contentEnter} style={styles.photoBadge}>
            <Ionicons name="checkmark" size={13} color={colors.text} />
            <Text style={styles.photoBadgeText}>COVER READY</Text>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onChoose}
          style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}>
          <Ionicons name="images-outline" size={17} color={colors.text} />
          <Text style={styles.actionText}>{photoUri ? 'CHANGE PHOTO' : 'CHOOSE PHOTO'}</Text>
        </Pressable>
        {photoUri ? (
          <Animated.View entering={pickerMotion.contentEnter} exiting={pickerMotion.contentExit}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={onRemove}
              style={({ pressed }) => [styles.removeAction, pressed && styles.pressed, disabled && styles.disabled]}>
              <Ionicons name="trash-outline" size={17} color={colors.primaryHover} />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
      <Text style={styles.help}>JPEG, PNG, WEBP, HEIC or HEIF · up to 6 MB</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  preview: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  placeholderCopy: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,6,10,0.10)',
  },
  photoBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,6,10,0.72)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  photoBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  actionText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  removeAction: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  help: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.48,
  },
});