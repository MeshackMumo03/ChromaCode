import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, FlatList, TouchableOpacity, View, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaseUrl } from '@/constants/api';
import { StyledButton } from '@/components/StyledButton';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = getBaseUrl();

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

export default function CreateGroupScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/users/friends`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name');
      return;
    }
    if (selectedFriends.length === 0) {
      Alert.alert('Required', 'Please select at least one friend');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${BASE_URL}/conversations/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName,
          participants: selectedFriends,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        router.replace(`/chat/${data._id}`);
      } else {
        Alert.alert('Error', data.message || 'Failed to create group');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error while creating group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText style={{ color: colors.tint }}>Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.title}>New Group</ThemedText>
          <TouchableOpacity onPress={handleCreateGroup} disabled={creating}>
            {creating ? <ActivityIndicator size="small" color={colors.tint} /> : 
              <ThemedText style={[styles.createBtn, { color: colors.tint }]}>Create</ThemedText>}
          </TouchableOpacity>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.icon + '33', backgroundColor: colors.icon + '10' }]}
            placeholder="Group Name"
            placeholderTextColor={colors.icon}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        <ThemedText style={styles.sectionTitle}>Select Friends ({selectedFriends.length})</ThemedText>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.tint} />
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const isSelected = selectedFriends.includes(item._id);
              return (
                <TouchableOpacity 
                  style={styles.friendItem} 
                  onPress={() => toggleFriend(item._id)}
                >
                  <Image 
                    source={{ uri: item.profilePicture || 'https://www.gravatar.com/avatar/?d=mp' }} 
                    style={styles.avatar} 
                  />
                  <ThemedText style={styles.friendName}>{item.username}</ThemedText>
                  <View style={[
                    styles.checkbox, 
                    { borderColor: colors.tint, backgroundColor: isSelected ? colors.tint : 'transparent' }
                  ]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createBtn: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputSection: {
    padding: 20,
    paddingTop: 0,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    opacity: 0.6,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 15,
  },
  friendName: {
    flex: 1,
    fontSize: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
