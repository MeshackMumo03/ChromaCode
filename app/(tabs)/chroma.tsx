
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  Alert,
  View,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Code } from '@/constants/codes';
import { ColorCodeButton } from '@/components/ColorCodeButton';
import { useHistory } from '@/hooks/useHistory';
import { useSettings } from '@/hooks/useSettings';
import UserSelectionModal, { SelectionType } from '@/components/UserSelectionModal';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCodes } from '@/hooks/useCodes';
import { useRouter, useFocusEffect } from 'expo-router';
import { getBaseUrl } from '@/constants/api';
import * as Haptics from 'expo-haptics';
import { useSocket } from '@/hooks/useSocket';
import { Ionicons } from '@expo/vector-icons';
import { StyledButton } from '@/components/StyledButton';

const BASE_URL = getBaseUrl();

// ─────────────────────────────────────────────
// Custom in-app Toast component
// ─────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';

interface ToastConfig {
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

const InAppToast = ({
  config,
  onHide,
  isDark,
}: {
  config: ToastConfig;
  onHide: () => void;
  isDark: boolean;
}) => {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config.visible) {
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
        ]).start(onHide);
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
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="none"
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
  );
};

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function ChromaScreen() {
  const { addHistoryItem } = useHistory();
  const { visibleCodes, addCodeToVisibleCodes } = useSettings();
  const { token, user } = useAuth();
  const socket = useSocket();
  const { codes, isLoading, fetchCodes } = useCodes();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const isDark = colorScheme === 'dark';

  // Toast state
  const [toast, setToast] = useState<ToastConfig>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', subtitle?: string, accentColor?: string) => {
      setToast({ visible: true, message, subtitle, type, accentColor });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // FAB animation
  const fabScale = useRef(new Animated.Value(1)).current;
  const onFabPressIn = () =>
    Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true }).start();
  const onFabPressOut = () =>
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCodes();
    setRefreshing(false);
  }, [fetchCodes]);

  // Refresh when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCodes();
    }, [fetchCodes])
  );

  useEffect(() => {
    if (socket && user) {
      const handleNewMessage = async (data: any) => {
        const hasCode = !!(data.message && (data.message.codeId || data.message.presetCodeId));
        const isSender =
          data.message.sender &&
          (data.message.sender._id === user._id || data.message.sender === user._id);

        if (hasCode && !isSender) {
          await fetchCodes();
          const codeName =
            typeof data.message.codeId === 'object' ? data.message.codeId.name : null;
          if (codeName) addCodeToVisibleCodes(codeName);
          showToast(
            '🎨 New Code Received!',
            'info',
            codeName ? `"${codeName}" added to your library` : 'A new color code has been added',
          );
        }
      };
      socket.on('new_message', handleNewMessage);
      return () => { socket.off('new_message', handleNewMessage); };
    }
  }, [socket, user, fetchCodes, addCodeToVisibleCodes, showToast]);

  useEffect(() => {
    if (codes.length > 0) {
      codes.forEach((code) => {
        if (!visibleCodes.includes(code.name)) addCodeToVisibleCodes(code.name);
      });
    }
  }, [codes, visibleCodes, addCodeToVisibleCodes]);

  const handlePress = (code: Code) => {
    setSelectedCode(code);
    setIsPreviewVisible(true);
  };

  const handleConfirmSend = () => {
    setIsPreviewVisible(false);
    setModalVisible(true);
  };

  const handleUserSelect = async (recipientId: string, type: SelectionType) => {
    if (!selectedCode || !token) {
      showToast('No code selected or not authenticated.', 'error');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Determine the correct codeId to send
    // Preset codes have _id like "preset-0"; custom codes have a real MongoDB ObjectId
    const isPreset = selectedCode._id && selectedCode._id.toString().startsWith('preset-');
    const codeIdToSend = selectedCode._id;

    try {
      if (type === 'group') {
        const response = await fetch(`${BASE_URL}/conversations/${recipientId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: `Shared the code: ${selectedCode.name} — ${selectedCode.meaning}`,
            codeId: codeIdToSend,
          }),
        });
        if (response.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(
            'Code sent to group! 🎉',
            'success',
            `"${selectedCode.name}" shared successfully`,
            selectedCode.color,
          );
        } else {
          const data = await response.json();
          showToast(data.message || 'Could not send code to group.', 'error');
        }
      } else {
        const response = await fetch(`${BASE_URL}/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientId,
            text: `Sent you the code: ${selectedCode.name} — ${selectedCode.meaning}`,
            codeId: codeIdToSend,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(
            'Code sent! ✨',
            'success',
            `"${selectedCode.name}" delivered`,
            selectedCode.color,
          );
          addHistoryItem(selectedCode, data.conversation._id, recipientId);
        } else {
          showToast(data.message || 'Could not send code.', 'error');
        }
      }
    } catch (error) {
      showToast('Network error while sending code.', 'error');
    }

    setModalVisible(false);
    setSelectedCode(null);
  };

  const filteredCodes = codes.filter((code) => {
    const isPreset = code._id && code._id.toString().startsWith('preset-');
    if (!isPreset) return true;
    return visibleCodes.includes(code.name);
  });

  if (isLoading && !refreshing) {
    return (
      <ThemedView
        style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={{ color: colors.text, marginTop: 12 }}>Loading codes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Custom Toast ── */}
        <InAppToast config={toast} onHide={hideToast} isDark={isDark} />

        {/* ── Page header ── */}
        <View style={[styles.pageHeader, { backgroundColor: isDark ? '#0F0F1A' : '#F7F8FF' }]}>
          <View>
            <ThemedText style={[styles.pageTitle, { color: colors.text }]}>Chroma Codes</ThemedText>
            <ThemedText style={[styles.pageSubtitle, { color: colors.icon }]}>
              {filteredCodes.length} code{filteredCodes.length !== 1 ? 's' : ''} in your library
            </ThemedText>
          </View>
        </View>

        {/* ── Preview card ── */}
        {isPreviewVisible && selectedCode ? (
          <View style={styles.previewWrapper}>
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
                  shadowColor: selectedCode.color,
                },
              ]}
            >
              {/* Color accent bar */}
              <View style={[styles.previewAccentBar, { backgroundColor: selectedCode.color }]} />
              <View style={[styles.previewColorWash, { backgroundColor: selectedCode.color + (isDark ? '0D' : '15') }]} />

              <View style={styles.previewContent}>
                <View style={styles.previewHeaderRow}>
                  <View style={[styles.previewColorCircle, { backgroundColor: selectedCode.color }]} />
                  <ThemedText style={[styles.previewName, { color: selectedCode.color }]}>
                    {selectedCode.name}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.previewMeaning, { color: colors.text }]}>
                  {selectedCode.meaning}
                </ThemedText>
                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={[styles.previewCancelBtn, { borderColor: colors.icon + '40' }]}
                    onPress={() => setIsPreviewVisible(false)}
                  >
                    <Ionicons name="close-outline" size={18} color={colors.icon} />
                    <ThemedText style={{ color: colors.icon, fontWeight: '600' }}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.previewSendBtn, { backgroundColor: selectedCode.color }]}
                    onPress={handleConfirmSend}
                  >
                    <Ionicons name="send" size={16} color="#fff" />
                    <ThemedText style={styles.previewSendBtnText}>Send to Friend</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            {filteredCodes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ThemedText style={{ fontSize: 60, marginBottom: 16 }}>🎨</ThemedText>
                <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No codes yet</ThemedText>
                <ThemedText style={[styles.emptyBody, { color: colors.icon }]}>
                  Tap the "Manage Codes" button to create your first chroma code!
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={filteredCodes}
                renderItem={({ item }) => (
                  <ColorCodeButton code={item} onPress={() => handlePress(item)} />
                )}
                keyExtractor={(item) => item._id}
                numColumns={2}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[colors.tint]}
                    tintColor={colors.tint}
                  />
                }
              />
            )}

            {/* ── FAB: Manage Codes ── */}
            <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
              <TouchableOpacity
                style={[styles.fabInner, { backgroundColor: colors.tint }]}
                onPress={() => router.push('/manage-codes')}
                onPressIn={onFabPressIn}
                onPressOut={onFabPressOut}
                activeOpacity={1}
              >
                <Ionicons name="settings-outline" size={20} color="#fff" />
                <ThemedText style={styles.fabLabel}>Manage Codes</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        <UserSelectionModal
          modalVisible={modalVisible}
          onClose={() => setModalVisible(false)}
          onUserSelect={handleUserSelect}
          code={selectedCode}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Toast ──
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 0 : 8,
    left: 16,
    right: 16,
    zIndex: 9999,
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
  // ── Header ──
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  // ── Code list ──
  list: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 100, // space for FAB
  },
  // ── Preview card ──
  previewWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    flexDirection: 'row',
  },
  previewAccentBar: {
    width: 8,
  },
  previewColorWash: {
    ...StyleSheet.absoluteFillObject,
    left: 8,
  },
  previewContent: {
    flex: 1,
    padding: 22,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  previewColorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  previewMeaning: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.9,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
  },
  previewCancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  previewSendBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  previewSendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    left: 20,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  fabLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
