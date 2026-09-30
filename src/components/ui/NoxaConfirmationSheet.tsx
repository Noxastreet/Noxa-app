import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { animations, colors, geometry, spacing, typography } from '@/src/theme';

import { NoxaButton, type NoxaButtonVariant } from './NoxaButton';
import { NoxaSurface } from './NoxaSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  eyebrow?: string;
  title: string;
  body: string;
  footnote?: string;
  icon?: IconName;
  cancelTitle?: string;
  confirmTitle: string;
  confirmVariant?: Extract<NoxaButtonVariant, 'primary' | 'danger'>;
  busy?: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function NoxaConfirmationSheet({
  visible,
  eyebrow,
  title,
  body,
  footnote,
  icon = 'alert-circle-outline',
  cancelTitle = 'Cancel',
  confirmTitle,
  confirmVariant = 'primary',
  busy = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: Props) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(visible ? 0 : 44)).current;
  const backdropOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dismissingRef = useRef(false);
  const motionEpoch = useRef(0);
  const contentRef = useRef({
    eyebrow,
    title,
    body,
    footnote,
    icon,
    cancelTitle,
    confirmTitle,
    confirmVariant,
  });

  if (visible) {
    contentRef.current = {
      eyebrow,
      title,
      body,
      footnote,
      icon,
      cancelTitle,
      confirmTitle,
      confirmVariant,
    };
  }
  const content = contentRef.current;

  const animateIn = useCallback(() => {
    motionEpoch.current += 1;
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();

    if (reduceMotion) {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...animations.spring.surface,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: animations.micro,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, reduceMotion, translateY]);

  const animateOut = useCallback(
    (after?: () => void) => {
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      const epoch = ++motionEpoch.current;
      translateY.stopAnimation();
      backdropOpacity.stopAnimation();

      const complete = () => {
        if (motionEpoch.current !== epoch) return;
        setRendered(false);
        dismissingRef.current = false;
        after?.();
      };

      if (reduceMotion) {
        translateY.setValue(44);
        backdropOpacity.setValue(0);
        complete();
        return;
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 44,
          duration: animations.fast,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: animations.fast,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) complete();
      });
    },
    [backdropOpacity, reduceMotion, translateY],
  );

  const requestCancel = useCallback(() => {
    if (busy) return;
    animateOut(onCancel);
  }, [animateOut, busy, onCancel]);

  useEffect(() => {
    if (visible) {
      motionEpoch.current += 1;
      dismissingRef.current = false;
      translateY.setValue(reduceMotion ? 0 : 44);
      backdropOpacity.setValue(reduceMotion ? 1 : 0);
      setRendered(true);
      return;
    }

    if (rendered && !dismissingRef.current) {
      animateOut();
    }
  }, [
    animateOut,
    backdropOpacity,
    reduceMotion,
    rendered,
    translateY,
    visible,
  ]);

  useEffect(() => {
    if (!rendered || !visible) return;
    animateIn();
  }, [animateIn, rendered, visible]);

  useEffect(() => () => {
    motionEpoch.current += 1;
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
  }, [backdropOpacity, translateY]);

  return (
    <Modal
      animationType="none"
      onRequestClose={requestCancel}
      statusBarTranslucent
      transparent
      visible={rendered}>
      <View accessibilityViewIsModal onAccessibilityEscape={requestCancel} style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityLabel="Cancel confirmation"
          accessibilityRole="button"
          disabled={busy}
          onPress={requestCancel}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          style={[
            styles.motionLayer,
            {
              transform: [{ translateY }],
            },
          ]}>
          <NoxaSurface
            corners="top"
            cut={geometry.cut.lg}
            level="sheet"
            style={styles.shell}>
            <ScrollView
              style={{ maxHeight: Math.max(44, windowHeight - insets.top - spacing.lg) }}
              contentContainerStyle={[styles.sheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}
              keyboardShouldPersistTaps="handled">
              <View style={styles.iconWrap}>
                <Ionicons
                  name={content.icon}
                  size={21}
                  color={
                    content.confirmVariant === 'danger'
                      ? colors.textCritical
                      : colors.text
                  }
                />
              </View>

              {content.eyebrow ? <Text style={styles.eyebrow}>{content.eyebrow}</Text> : null}
              <Text accessibilityRole="header" style={styles.title}>{content.title}</Text>
              <Text style={styles.body}>{content.body}</Text>
              {content.footnote ? <Text style={styles.footnote}>{content.footnote}</Text> : null}

              <View style={styles.actions}>
                <NoxaButton
                  disabled={busy}
                  fullWidth
                  onPress={requestCancel}
                  size="md"
                  title={content.cancelTitle}
                  variant="secondary"
                />
                <NoxaButton
                  disabled={confirmDisabled}
                  fullWidth
                  loading={busy}
                  onPress={onConfirm}
                  size="md"
                  title={content.confirmTitle}
                  variant={content.confirmVariant}
                />
              </View>
            </ScrollView>
          </NoxaSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  motionLayer: {
    width: '100%',
  },
  shell: { overflow: 'hidden' },
  sheet: {
    gap: spacing.sm,
    paddingHorizontal: geometry.sheet.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  eyebrow: {
    marginTop: spacing.xs,
    color: colors.textCritical,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  body: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
