import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastConfig {
  visible: boolean;
  message: string;
  subtitle?: string;
  type: ToastType;
  accentColor?: string;
}

const TOAST_ICON: Record<ToastType, string> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const TOAST_BG: Record<ToastType, string> = {
  success: '#12B76A',
  error: '#F04438',
  info: '#0EA5E9',
};

interface InAppToastProps {
  config: ToastConfig;
  onHide: () => void;
}

export const InAppToast: React.FC<InAppToastProps> = ({ config, onHide }) => {
  const isDark = useColorScheme() === 'dark';
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config.visible) {
      // Reset to hidden position before animating in
      translateY.setValue(-120);
      opacity.setValue(0);

      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3.5 s
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -120,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, 3500);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }
  }, [config.visible]);

  if (!config.visible) return null;

  const accentColor = config.accentColor || TOAST_BG[config.type];
  const cardBg = isDark ? '#1C1C28' : '#FFFFFF';

  return (
    // Use a non-animated View for pointerEvents to avoid crashes on some RN versions
    <View style={styles.toastContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.toastAnimated,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View
          style={[
            styles.toastCard,
            {
              backgroundColor: cardBg,
              shadowColor: accentColor,
            },
          ]}
        >
          {/* Left accent bar */}
          <View style={[styles.toastAccent, { backgroundColor: accentColor }]} />

          {/* Icon */}
          <View style={[styles.toastIconWrap, { backgroundColor: accentColor + '22' }]}>
            <Ionicons
              name={TOAST_ICON[config.type] as any}
              size={22}
              color={accentColor}
            />
          </View>

          {/* Text */}
          <View style={styles.toastTextWrap}>
            <ThemedText style={[styles.toastTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {config.message}
            </ThemedText>
            {config.subtitle ? (
              <ThemedText style={[styles.toastSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {config.subtitle}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};


const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 0 : 8,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastAnimated: {
    width: '100%',
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    minHeight: 68,
  },
  toastAccent: {
    width: 5,
    alignSelf: 'stretch',
  },
  toastIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 10,
    flexShrink: 0,
  },
  toastTextWrap: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  toastSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
