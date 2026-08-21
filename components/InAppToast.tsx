/**
 * InAppToast – fully self-contained, zero context dependencies.
 *
 * IMPORTANT: This component is rendered by ToastProvider which sits ABOVE
 * SettingsProvider and ThemeProvider in the tree.  It must NOT call any hook
 * that relies on those contexts (useColorScheme, ThemedText, useSettings…).
 * Use React Native's built-in useColorScheme and plain <Text> instead.
 *
 * The optional `isDark` prop lets ToastProvider override OS-level detection
 * with the user's explicit in-app theme preference.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Platform,
    StyleSheet,
    Text,
    useColorScheme as useRNColorScheme,
    View,
} from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastConfig {
  visible: boolean;
  message: string;
  subtitle?: string;
  type: ToastType;
  accentColor?: string;
}

const TOAST_ICON: Record<ToastType, any> = {
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
  /** Override OS color scheme with the user's explicit in-app preference */
  isDark?: boolean;
}

export const InAppToast: React.FC<InAppToastProps> = ({ config, onHide, isDark: isDarkProp }) => {
  // Fall back to OS color scheme only when no explicit override is provided.
  // ToastProvider passes the user's in-app preference via `isDarkProp`.
  const scheme = useRNColorScheme();
  const isDark = isDarkProp !== undefined ? isDarkProp : scheme === 'dark';

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config.visible) {
      // Reset position before animating in (handles rapid consecutive toasts)
      translateY.setValue(-120);
      opacity.setValue(0);

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
      }, 7000);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }
  }, [config.visible]);

  if (!config.visible) return null;

  const accentColor = config.accentColor || TOAST_BG[config.type];
  const cardBg = isDark ? '#1C1C28' : '#FFFFFF';
  const titleColor = isDark ? '#FFFFFF' : '#111827';
  const subtitleColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    // A plain View carries pointerEvents safely across all RN versions
    <View style={styles.toastContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.toastAnimated,
          { transform: [{ translateY }], opacity },
        ]}
      >
        <View style={[styles.toastCard, { backgroundColor: cardBg, shadowColor: accentColor }]}>
          {/* Left accent bar */}
          <View style={[styles.toastAccent, { backgroundColor: accentColor }]} />

          {/* Icon */}
          <View style={[styles.toastIconWrap, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name={TOAST_ICON[config.type]} size={22} color={accentColor} />
          </View>

          {/* Text */}
          <View style={styles.toastTextWrap}>
            <Text style={[styles.toastTitle, { color: titleColor }]} numberOfLines={6}>
              {config.message}
            </Text>
            {config.subtitle ? (
              <Text style={[styles.toastSubtitle, { color: subtitleColor }]} numberOfLines={1}>
                {config.subtitle}
              </Text>
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
    // Increased top padding to clear the status bar / notch on both platforms.
    // iOS: 80px clears the tallest Dynamic Island / notch.
    // Android: 70px clears the status bar with a comfortable buffer.
    top: Platform.OS === 'ios' ? 80 : 70,
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
