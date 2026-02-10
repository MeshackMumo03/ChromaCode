import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, FlatList, TouchableOpacity, Alert, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { Code } from '@/constants/codes';
import { getBaseUrl } from '@/constants/api'; // Import getBaseUrl

const BASE_URL = getBaseUrl(); // Use the centralized getBaseUrl()

interface User {
  _id: string;
  username: string;
}

interface UserSelectionModalProps {
  modalVisible: boolean;
  onClose: () => void;
  onUserSelect: (userId: string) => void;
  code: Code | null;
}

export default function UserSelectionModal({ modalVisible, onClose, onUserSelect, code }: UserSelectionModalProps) {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (modalVisible) {
      const fetchUsers = async () => {
        try {
          const response = await fetch(`${BASE_URL}/users/friends`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          if (response.ok) {
            setUsers(data);
          } else {
            Alert.alert('Error', 'Failed to fetch users.');
          }
        } catch (error) {
          Alert.alert('Error', 'Network error while fetching users.');
        }
      };
      fetchUsers();
    }
  }, [modalVisible, token]);

  const handleSelect = (userId: string) => {
    onUserSelect(userId);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <ThemedView style={styles.modalView}>
          <ThemedText style={styles.modalText}>Select a user to send "{code?.name}" to:</ThemedText>
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelect(item._id)}>
                <ThemedText style={styles.userText}>{item.username}</ThemedText>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <ThemedText>Close</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userText: {
    padding: 10,
    fontSize: 16,
  },
  closeButton: {
    marginTop: 20,
  },
});
