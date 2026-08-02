import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/src/theme';

type NoxaAppleAuthButtonProps = {
  disabled?: boolean;
  onPress: () => void;
};

export function NoxaAppleAuthButton({
  disabled = false,
  onPress,
}: NoxaAppleAuthButtonProps) {
  return (
    <View
      accessibilityState={{ disabled }}
      pointerEvents={disabled ? 'none' : 'auto'}
      style={[styles.frame, disabled && styles.disabled]}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        cornerRadius={radius.button}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    minHeight: 54,
  },
  button: {
    width: '100%',
    height: 54,
  },
  disabled: {
    opacity: 0.45,
  },
});
