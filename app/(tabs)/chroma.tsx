
import React, { useState } from 'react';
import { StyleSheet, FlatList, Alert, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { CODES, Code } from '@/constants/codes';
import { ColorCodeButton } from '@/components/ColorCodeButton';
import { useHistory } from '@/hooks/useHistory';
import { useSettings } from '@/hooks/useSettings';
import { Link } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import UserSelectionModal from '@/components/UserSelectionModal'; // Import the modal
import { useAuth } from '@/hooks/useAuth';

export default function ChromaScreen() {
  const { addHistoryItem } = useHistory();
  const { visibleCodes } = useSettings();
  const { token } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);

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
        addHistoryItem(selectedCode); // Still add to history after sending
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

  const filteredCodes = CODES.filter(code => visibleCodes.includes(code.name));

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Chroma Codes</ThemedText>
        <Link href="/modal" style={styles.customizeButton}>
          <IconSymbol size={28} name="gearshape.fill" />
        </Link>
      </View>
      <FlatList
        data={filteredCodes}
        renderItem={({ item }) => (
          <ColorCodeButton code={item} onPress={() => handlePress(item)} />
        )}
        keyExtractor={(item) => item.name}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  customizeButton: {
    marginRight: 15,
  },
});
