import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, FlatList, Alert, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HelloWave } from '@/components/hello-wave';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router'; // Add useRouter import

const BASE_URL = 'http://172.30.10.196:5000/api'; // Backend API URL

interface User {
  _id: string;
  username: string;
  profilePicture?: string;
}

export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter(); // Initialize useRouter
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [friends, setFriends] = useState<User[]>([]); // New state for friends
  const [isFetchingFriends, setIsFetchingFriends] = useState(false); // New state for friends loading

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/users/search?username=${searchTerm}`, {
        headers: {
          'Authorization': `Bearer ${token}`, // Assuming search is protected
        },
      });
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data);
      } else {
        Alert.alert('Error', data.message || 'Failed to search users.');
      }
    } catch (error) {
      console.error('Network error during user search:', error);
      Alert.alert('Error', 'Network error during user search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFriend = async (friendId: string, friendUsername: string) => {
    try {
      const response = await fetch(`${BASE_URL}/users/add-friend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Assuming add-friend is protected
        },
        body: JSON.stringify({ friendId }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', `${friendUsername} added as a friend!`);
        // Optionally, refresh search results or user's friend list
      } else {
        Alert.alert('Error', data.message || `Failed to add ${friendUsername} as a friend.`);
      }
    } catch (error) {
      console.error('Network error during adding friend:', error);
      Alert.alert('Error', 'Network error during adding friend.');
    }
  };

  const handleStartChat = async (friendId: string, friendUsername: string) => {
    if (!token || !user) {
      Alert.alert('Error', 'Not authenticated.');
      return;
    }

    try {
      // The backend's startConversation requires a 'text' field, even if empty to initiate.
      const response = await fetch(`${BASE_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: friendId, text: 'Hi!' }), // Dummy message to initiate
      });

      const data = await response.json();

      if (response.ok && data.conversation?._id) {
        router.push(`/chat/${data.conversation._id}`);
      } else {
        Alert.alert('Error', data.message || `Failed to start chat with ${friendUsername}.`);
      }
    } catch (error) {
      console.error('Network error during starting chat:', error);
      Alert.alert('Error', 'Network error during starting chat.');
    }
  };

  const fetchFriends = async () => {
    if (!token) {
      setFriends([]);
      return;
    }
    setIsFetchingFriends(true);
    try {
      const response = await fetch(`${BASE_URL}/users/friends`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setFriends(data);
      } else {
        Alert.alert('Error', data.message || 'Failed to fetch friends.');
      }
    } catch (error) {
      console.error('Network error during fetching friends:', error);
      Alert.alert('Error', 'Network error during fetching friends.');
    } finally {
      setIsFetchingFriends(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [token]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <HelloWave />
        <ThemedText style={styles.title}>Welcome to ChromaCode!</ThemedText>
      </View>
      
      {/* User Search Section */}
      <ThemedText style={styles.sectionTitle}>Find Friends</ThemedText>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username"
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
        />
        <Button title="Search" onPress={handleSearch} disabled={isLoading} />
      </View>

      {isLoading ? (
        <ThemedText>Searching...</ThemedText>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.userResultItem}>
              <ThemedText>{item.username}</ThemedText>
              {user?._id !== item._id && ( // Don't allow adding self
                <Button title="Add Friend" onPress={() => handleAddFriend(item._id, item.username)} />
              )}
            </View>
          )}
          style={styles.searchResultsList}
        />
      )}

      {/* Your Friends Section */}
      <ThemedText style={styles.sectionTitle}>Your Friends</ThemedText>
      {isFetchingFriends ? (
        <ThemedText>Loading friends...</ThemedText>
      ) : (
        friends.length > 0 ? (
          <FlatList
            data={friends}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userResultItem}
                onPress={() => handleStartChat(item._id, item.username)}
              >
                <ThemedText>{item.username}</ThemedText>
                <ThemedText style={{ color: 'grey' }}>Start Chat</ThemedText>
              </TouchableOpacity>
            )}
            style={styles.friendsList} // Using a new style for friends list
            contentContainerStyle={friends.length > 0 ? null : styles.noFriendsContent}
          />
        ) : (
          <ThemedText style={styles.noFriendsText}>No friends yet. Find some above!</ThemedText>
        )
      )}

      {/* Original Content */}
      <View style={styles.content}>
        <ThemedText style={styles.subtitle}>Your secret language, simplified.</ThemedText>
        <ThemedText style={styles.paragraph}>
          ChromaCode helps you communicate with your close friends, family, or partner using a color-based language that you create together.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          Go to the <ThemedText style={{ fontWeight: 'bold' }}>Chroma</ThemedText> tab to send a code, check the <ThemedText style={{ fontWeight: 'bold' }}>History</ThemedText> tab to see your recent communications, and customize your codes in the settings.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start', // Align items to start for scrollable content
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    width: '100%',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: 'white',
  },
  searchResultsList: {
    width: '100%',
    maxHeight: 200, // Limit height for scrollability
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 20,
  },
  userResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  content: {
    width: '100%',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 10,
  },
  friendsList: {
    width: '100%',
    maxHeight: 200, // Limit height for scrollability
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 20,
  },
  noFriendsContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noFriendsText: {
    fontSize: 16,
    color: 'grey',
  },
});
