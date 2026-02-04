import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Button, Alert, Image, ScrollView, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

const BASE_URL = 'http://172.30.10.196:5000/api'; // Backend API URL

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');

  // Chat states
  const [recipient, setRecipient] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [messages, setMessages] = useState<{ sender: string; text: string; }[]>([]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setProfilePicture(user.profilePicture);
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!token) {
      Alert.alert('Error', 'Not authenticated.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ username, email, profilePicture }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully.');
        // Optionally, update the user context with new data
        // For simplicity, we'll just re-fetch in a real app or update context
      } else {
        Alert.alert('Update Failed', data.message || 'Could not update profile.');
      }
    } catch (error) {
      console.error('Network error during profile update:', error);
      Alert.alert('Error', 'Network error during profile update.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) {
      Alert.alert('Error', 'Not authenticated.');
      return;
    }

    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/users/profile`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                Alert.alert('Success', 'Account deleted successfully.');
                logout(); // Log out after successful deletion
                router.replace('/login'); // Redirect to login
              } else {
                const data = await response.json();
                Alert.alert('Deletion Failed', data.message || 'Could not delete account.');
              }
            } catch (error) {
              console.error('Network error during account deletion:', error);
              Alert.alert('Error', 'Network error during account deletion.');
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const handleLogout = () => {
    logout();
    router.replace('/login'); // Redirect to login after logout
  };

  const handleSendMessage = () => {
    if (!recipient || !colorCode) {
      Alert.alert('Error', 'Please enter both recipient and color code.');
      return;
    }

    const newMessage = { sender: user?.username || 'You', text: `To ${recipient}: ${colorCode}` };
    setMessages([...messages, newMessage]);
    
    // TODO: Implement actual backend call to send message to recipient
    console.log(`Sending color code ${colorCode} to ${recipient}`);

    setRecipient('');
    setColorCode('');
  };

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Please log in to view your profile.</ThemedText>
        <Button title="Go to Login" onPress={() => router.replace('/login')} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedText style={styles.title}>Profile</ThemedText>
        <Image source={{ uri: profilePicture }} style={styles.profileImage} />
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={false} // Email typically not editable directly here
        />
        <TextInput
          style={styles.input}
          placeholder="Profile Picture URL"
          value={profilePicture}
          onChangeText={setProfilePicture}
        />
              <Button title="Update Profile" onPress={handleUpdateProfile} />
        
              {/* Chat Section */}
              <ThemedText style={styles.chatTitle}>Chat with other users</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Recipient Username"
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Color Code (e.g., #FFFFFF)"
                value={colorCode}
                onChangeText={setColorCode}
                autoCapitalize="none"
              />
              <Button title="Send Color Code" onPress={handleSendMessage} />
        
              <View style={styles.messagesContainer}>
                <ThemedText style={styles.messagesHeader}>Messages:</ThemedText>
                {messages.map((msg, index) => (
                  <ThemedText key={index} style={styles.messageText}>
                    <ThemedText style={{ fontWeight: 'bold' }}>{msg.sender}:</ThemedText> {msg.text}
                  </ThemedText>
                ))}
              </View>
        
              <ThemedText style={styles.logoutButton} onPress={handleLogout}>
                Logout
              </ThemedText>
              <ThemedText style={styles.deleteButton} onPress={handleDeleteAccount}>
                Delete Account
              </ThemedText>      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
    backgroundColor: '#ccc',
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: 'white',
  },
  chatTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 20,
  },
  messagesContainer: {
    width: '100%',
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    maxHeight: 200, // Limit height for scrollability
  },
  messagesHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  messageText: {
    marginBottom: 5,
  },
  logoutButton: {
    marginTop: 20,
    color: 'blue',
  },
  deleteButton: {
    marginTop: 10,
    color: 'red',
  },
});
