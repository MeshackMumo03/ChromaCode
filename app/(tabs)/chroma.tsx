
import React, { useState } from 'react';
import { StyleSheet, FlatList, Alert, View, ActivityIndicator } from 'react-native';
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
import { useRouter } from 'expo-router'; // Import useRouter

export default function ChromaScreen() {
  const { addHistoryItem } = useHistory();
  const { visibleCodes } = useSettings();
  const { token } = useAuth();
  const { codes, isLoading, fetchCodes } = useCodes(); // Get codes and loading state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const handlePress = (code: Code) => {
    setSelectedCode(code);
    setModalVisible(true);
  };

  const handleUserSelect = async (recipientId: string) => {
    if (!selectedCode || !token) {
      Alert.alert('Error', 'No code selected or not authenticated.');
      return;
    }

    try {
      const response = await fetch('http://172.30.10.196:5000/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId,
          text: `Sent you the code: ${selectedCode.name} - ${selectedCode.meaning}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `Code sent to user!`);
        // We now need to pass the selectedCode._id and recipientId to addHistoryItem
        addHistoryItem(selectedCode, data.conversation._id, recipientId); // Assuming conversation._id is returned
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

  const filteredCodes = codes.filter(code => visibleCodes.includes(code.name));

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={{ color: colors.text, marginTop: 10 }}>Loading codes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: colors.text }]}>Chroma Codes</ThemedText>
        <Button title="Manage Codes" onPress={() => router.push('/manage-codes')} color={colors.tint} />
      </View>
      <FlatList
        data={filteredCodes}
        renderItem={({ item }) => (
          <ColorCodeButton code={item} onPress={() => handlePress(item)} />
        )}
        keyExtractor={(item) => item._id} // Use _id as key
        numColumns={2}
        contentContainerStyle={styles.list}
      />
      <UserSelectionModal
        modalVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        onUserSelect={handleUserSelect}
        code={selectedCode}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
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
});
