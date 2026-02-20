
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, FlatList, Alert, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Code } from '@/constants/codes'; // Keep Code interface, remove CODES import
import { ColorCodeButton } from '@/components/ColorCodeButton';
import { useHistory } from '@/hooks/useHistory';
import { useSettings } from '@/hooks/useSettings';
import UserSelectionModal from '@/components/UserSelectionModal';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';
import { useCodes } from '@/hooks/useCodes'; // Import useCodes
import { useRouter, useFocusEffect } from 'expo-router'; // Import useRouter
import { StyledButton } from '@/components/StyledButton'; // Import StyledButton
import { getBaseUrl } from '@/constants/api';
import * as Haptics from 'expo-haptics';
import { useSocket } from '@/hooks/useSocket';

const BASE_URL = getBaseUrl();

export default function ChromaScreen() {
  const { addHistoryItem } = useHistory();
  const { visibleCodes, addCodeToVisibleCodes } = useSettings();
  const { token, user } = useAuth();
  const socket = useSocket();
  const { codes, isLoading, fetchCodes } = useCodes(); // Get codes and loading state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

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
    if (socket) {
      const handleNewMessage = async (data: any) => {
        // Check for codeId in the message (could be populated object or ID string)
        if (data.message.codeId) {
          console.log('ChromaScreen: New shared code detected via socket');
          await fetchCodes();
          
          // Auto-make visible if we have the name
          if (typeof data.message.codeId === 'object') {
            addCodeToVisibleCodes(data.message.codeId.name);
          }
          
          Alert.alert('New Code Shared!', `A new color code has been added to your library.`);
        }
      };

      socket.on('new_message', async (data) => {
        // CRITICAL DEBUG LOG
        console.log('Chroma Tab: Socket Event Received:', JSON.stringify(data, null, 2));

        // Check if the message contains a code
        const hasCode = !!(data.message && data.message.codeId);
        
        if (hasCode) {
          console.log('Chroma Tab: New code detected! Fetching library...');
          await fetchCodes();
          
          // Try to get name for visibility
          const codeName = typeof data.message.codeId === 'object' 
            ? data.message.codeId.name 
            : null;

          if (codeName) {
            addCodeToVisibleCodes(codeName);
          }
          
          Alert.alert('New Code Shared!', `A new color code has been added to your library.`);
        }
      });
    }
  }, [socket, fetchCodes, addCodeToVisibleCodes]);

  // Ensure all current codes are visible if they are new
  useEffect(() => {
    if (codes.length > 0) {
      codes.forEach(code => {
        if (!visibleCodes.includes(code.name)) {
          addCodeToVisibleCodes(code.name);
        }
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

  const handleUserSelect = async (recipientId: string) => {
    if (!selectedCode || !token) {
      Alert.alert('Error', 'No code selected or not authenticated.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(`${BASE_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId,
          text: `Sent you the code: ${selectedCode.name} - ${selectedCode.meaning}`,
          codeId: selectedCode._id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', `Code sent to user!`);
        // We now need to pass the selectedCode._id and recipientId to addHistoryItem
        addHistoryItem(selectedCode, data.conversation._id, recipientId); 
      } else {
        Alert.alert('Send Failed', data.message || 'Could not send code.');
      }
    } catch (error) {
      console.error('Network error during sending code:', error);
      Alert.alert('Error', 'Network error while sending code.');
    }

    setModalVisible(false);
    setSelectedCode(null);
  };

  // Always show codes that are in the database (custom/shared), 
  // only filter the preset placeholders.
  const filteredCodes = codes.filter(code => {
    const isPreset = code._id && code._id.toString().startsWith('preset-');
    if (!isPreset) return true; // Always show custom/shared codes
    return visibleCodes.includes(code.name); // Filter presets
  });

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={{ color: colors.text, marginTop: 10 }}>Loading codes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Chroma Codes</ThemedText>
          {!isPreviewVisible && <StyledButton title="Manage Codes" onPress={() => router.push('/manage-codes')} />}
        </View>

        {isPreviewVisible && selectedCode ? (
          <View style={styles.previewContainer}>
            <View style={[styles.previewCard, { backgroundColor: colorScheme === 'dark' ? '#1A1A1A' : '#F5F5F5', borderLeftWidth: 10, borderLeftColor: selectedCode.color }]}>
              <View style={styles.previewHeader}>
                <View style={[styles.previewColorCircle, { backgroundColor: selectedCode.color }]} />
                <ThemedText style={styles.previewName}>{selectedCode.name}</ThemedText>
              </View>
              <ThemedText style={[styles.previewMeaning, { color: colors.text }]}>{selectedCode.meaning}</ThemedText>
              
              <View style={styles.previewActions}>
                <StyledButton 
                  title="Cancel" 
                  onPress={() => setIsPreviewVisible(false)} 
                  style={{ backgroundColor: colors.icon, flex: 1, marginRight: 10 }} 
                />
                <StyledButton 
                  title="Send to Friend" 
                  onPress={handleConfirmSend} 
                  style={{ flex: 2 }} 
                />
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            data={filteredCodes}
            renderItem={({ item }) => (
              <ColorCodeButton code={item} onPress={() => handlePress(item)} />
            )}
            keyExtractor={(item) => item._id} // Use _id as key
            numColumns={2}
            contentContainerStyle={styles.list}
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
    padding: 10,
    paddingTop: 15,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  list: {
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    padding: 25,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  previewColorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 15,
  },
  previewName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  previewMeaning: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 30,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
