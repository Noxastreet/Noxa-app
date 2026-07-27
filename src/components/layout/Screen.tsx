import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

import { useResponsive } from '../../hooks/useResponsive';
import { colors } from '../../theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  constrained?: boolean;
  keyboardAvoiding?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<
    ScrollViewProps,
    'contentContainerStyle'
  >;
}>;

export function Screen({
  children,
  scroll = false,
  padded = true,
  constrained = true,
  keyboardAvoiding = false,
  edges = ['top', 'left', 'right'],
  contentStyle,
  scrollProps,
}: ScreenProps) {
  const responsive = useResponsive();

  const adaptiveStyle: ViewStyle = {
    width: '100%',
    maxWidth: constrained
      ? responsive.contentMaxWidth
      : undefined,
    alignSelf: 'center',
    paddingHorizontal: padded
      ? responsive.gutter
      : 0,
  };

  const content = scroll ? (
    <ScrollView
      {...scrollProps}
      style={[styles.scroll, scrollProps?.style]}
      contentContainerStyle={[
        styles.scrollContent,
        adaptiveStyle,
        contentStyle,
      ]}
      keyboardShouldPersistTaps={
        scrollProps?.keyboardShouldPersistTaps ??
        'handled'
      }
      showsVerticalScrollIndicator={
        scrollProps?.showsVerticalScrollIndicator ??
        false
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        adaptiveStyle,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={edges}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoiding}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flex: 1,
  },

  keyboardAvoiding: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  content: {
    flex: 1,
  },
});
