import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

import { Text } from './Text';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as a fraction of the window (default 0.9). */
  maxHeightRatio?: number;
  /** Disable swipe-to-dismiss (e.g. when the content scrolls). */
  disableGesture?: boolean;
}

const SPRING = { damping: 22, stiffness: 240, mass: 0.9 };

/**
 * Instagram-style bottom sheet: dimmed backdrop, rounded top, drag handle, swipe to dismiss.
 * Built on Reanimated + Gesture Handler so it stays at 60fps in Expo Go.
 */
export function BottomSheet({ visible, onClose, title, children, maxHeightRatio = 0.9, disableGesture = false }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // "mounted" stays true during the exit animation; it is derived at render time when opening
  // and cleared from the animation callback when closing.
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }
  const translateY = useSharedValue(windowHeight);
  const backdrop = useSharedValue(0);
  const sheetHeight = useSharedValue(0);

  const finishClose = useCallback(() => {
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      translateY.set(windowHeight);
      backdrop.set(withTiming(1, { duration: 180 }));
      translateY.set(withSpring(0, SPRING));
      return undefined;
    }
    backdrop.set(withTiming(0, { duration: 160 }));
    translateY.set(
      withTiming(windowHeight, { duration: 200 }, (done) => {
        if (done) runOnJS(finishClose)();
      }),
    );
    return undefined;
  }, [visible, windowHeight, translateY, backdrop, finishClose]);

  const pan = Gesture.Pan()
    .enabled(!disableGesture)
    // Only a real downward drag activates the gesture — taps on buttons inside pass through untouched.
    .activeOffsetY(12)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      const threshold = Math.max(80, sheetHeight.get() * 0.3);
      const shouldClose = e.translationY > threshold || e.velocityY > 900;
      if (shouldClose) {
        runOnJS(onClose)();
      } else {
        translateY.set(withSpring(0, SPRING));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.backdrop, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="close" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.avoid}>
          <Animated.View
            onLayout={(e) => {
              sheetHeight.set(e.nativeEvent.layout.height);
            }}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.sheet,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                maxHeight: windowHeight * maxHeightRatio,
              },
              sheetStyle,
            ]}
          >
            {/* Only the grab area is draggable, so buttons/inputs inside never fight the gesture. */}
            <GestureDetector gesture={pan}>
              <View style={styles.grabArea}>
                <View style={styles.handleRow}>
                  <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
                </View>
                {title ? (
                  <View style={[styles.titleRow, { borderBottomColor: colors.border }]}>
                    <Text variant="title" align="center">
                      {title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // Anchored to the bottom and sized to its content, so it never covers the tappable backdrop.
  avoid: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  grabArea: { minHeight: 24 },
  handleRow: { alignItems: 'center', paddingBottom: spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  titleRow: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: spacing.xs },
});
