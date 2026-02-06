import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Button, Alert, Image, ScrollView, View, ImageBackground } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

const BASE_URL = 'http://172.30.10.196:5000/api'; // Backend API URL

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');

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
        updateUser(data.user); // Update the user in the AuthContext
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
                logout();
                router.replace('/login');
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
    router.replace('/login');
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
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1434394354979-a235cd36269d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTJ8fG1vdW50YWluc3xlbnwwfHwwfHw%3D&auto=format&fit=crop&w=900&q=60' }}
          style={styles.headerBackground}
        >
        </ImageBackground>
        <View style={styles.profilePictureContainer}>
            <Image source={{ uri: profilePicture }} style={styles.profileImage} />
        </View>
      </View>
      
      <View style={styles.userInfoContainer}>
        <ThemedText style={styles.userName}>{username}</ThemedText>
        <ThemedText style={styles.userEmail}>{email}</ThemedText>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Profile Picture URL"
          value={profilePicture}
          onChangeText={setProfilePicture}
        />
        <Button title="Update Profile" onPress={handleUpdateProfile} />

        <View style={styles.buttonContainer}>
            <ThemedText style={styles.logoutButton} onPress={handleLogout}>
                Logout
            </ThemedText>
            <ThemedText style={styles.deleteButton} onPress={handleDeleteAccount}>
                Delete Account
            </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerContainer: {
        height: 200,
    },
    headerBackground: {
        width: '100%',
        height: 140,
    },
    profilePictureContainer: {
        position: 'absolute',
        top: 95, 
        left: 24,
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#C0C0C0'
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    userInfoContainer: {
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    userEmail: {
        fontSize: 16,
        color: 'gray',
    },
    formContainer: {
        paddingHorizontal: 20,
    },
    input: {
        width: '100%',
        padding: 15,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        marginBottom: 15,
    },
    buttonContainer: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    logoutButton: {
        color: 'blue',
        fontSize: 16,
    },
    deleteButton: {
        color: 'red',
        fontSize: 16,
    },
});
