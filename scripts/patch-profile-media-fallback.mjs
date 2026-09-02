import fs from 'node:fs';

const path = 'app/(tabs)/profile.tsx';
let source = fs.readFileSync(path, 'utf8');

const before = `        {vehicle.cover_image_url ? (\n          <ImageBackground\n            source={{ uri: vehicle.cover_image_url }}\n            resizeMode="cover"\n            style={styles.vehicleArtwork}\n            imageStyle={styles.vehicleArtworkRadius as ImageStyle}>\n            {content}\n          </ImageBackground>\n        ) : (\n          <View style={[styles.vehicleArtwork, styles.vehicleFallback]}>\n            <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={68} color={colors.primaryMuted} />\n            {content}\n          </View>\n        )}`;

const after = `        {vehicle.cover_image_url ? (\n          <ImageBackground\n            source={{ uri: vehicle.cover_image_url }}\n            resizeMode="cover"\n            style={styles.vehicleArtwork}\n            imageStyle={styles.vehicleArtworkRadius as ImageStyle}>\n            {content}\n          </ImageBackground>\n        ) : (\n          <View style={[styles.vehicleArtwork, styles.vehicleFallback]}>\n            <View style={styles.vehicleFallbackVisual}>\n              <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={34} color={colors.textMuted} />\n              <Text style={styles.vehicleFallbackLabel}>NO PHOTO</Text>\n            </View>\n            {content}\n          </View>\n        )}`;

if (!source.includes(before)) throw new Error('Vehicle fallback block not found');
source = source.replace(before, after);

source = source.replace(
  `  vehicleFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },\n`,
  `  vehicleFallback: { backgroundColor: colors.surfaceSoft },\n  vehicleFallbackVisual: {\n    position: 'absolute',\n    top: 52,\n    left: spacing.md,\n    flexDirection: 'row',\n    alignItems: 'center',\n    gap: spacing.sm,\n    opacity: 0.55,\n  },\n  vehicleFallbackLabel: {\n    color: colors.textMuted,\n    fontSize: 9,\n    fontWeight: '900',\n    letterSpacing: 1.1,\n  },\n`,
);

fs.writeFileSync(path, source);
console.log('Profile media fallback simplified.');
