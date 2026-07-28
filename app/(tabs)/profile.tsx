import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, ScrollView, View, ImageBackground } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useNavigation } from 'expo-router';
import { StyledButton } from '@/components/StyledButton'; // Import StyledButton
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaseUrl, getImageUrl } from '@/constants/api'; // Import getBaseUrl and getImageUrl

import * as ImagePicker from 'expo-image-picker';
import { RefreshControl, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = getBaseUrl(); // Backend API URL

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Profile',
      headerShown: true,
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => router.push('/settings')}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.text]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setProfilePicture(user.profilePicture);
      fetchFriendRequests();
    }
  }, [user]);

  const fetchFriendRequests = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/users/friend-requests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setFriendRequests(data);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const handleUpdateProfile = async (imageUri?: string) => {
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
        body: JSON.stringify({ 
          username, 
          email, 
          profilePicture: imageUri || profilePicture 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (!imageUri) Alert.alert('Success', 'Profile updated successfully.');
        updateUser(data.user);
      } else {
        Alert.alert('Update Failed', data.message || 'Could not update profile.');
      }
    } catch (error) {
      console.error('Network error during profile update:', error);
      Alert.alert('Error', 'Network error during profile update.');
    }
  };

  const uploadToBackend = async (uri: string) => {
    setRefreshing(true);
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    } as any);

    try {
      const response = await fetch(`${BASE_URL}/users/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (data.imageUrl) {
        setProfilePicture(data.imageUrl);
        handleUpdateProfile(data.imageUrl);
      } else {
        console.error('Backend upload error:', data);
        Alert.alert('Upload Failed', data.message || 'Could not upload image.');
      }
    } catch (error) {
      console.error('Backend upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload image to server.');
    } finally {
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadToBackend(result.assets[0].uri);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch(`${BASE_URL}/users/friend-request/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId }),
      });

      if (response.ok) {
        setFriendRequests(prev => prev.filter(req => req._id !== requestId));
        if (action === 'accept') Alert.alert('Accepted', 'Friend request accepted!');
      }
    } catch (error) {
      console.error(`Error during friend request ${action}:`, error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriendRequests();
    setRefreshing(false);
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
  };

  if (!user) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText style={{ color: colors.text }}>Please log in to view your profile.</ThemedText>
        <StyledButton title="Go to Login" onPress={() => router.replace('/login')} />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={[styles.scrollViewContainer, { backgroundColor: colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerContainer}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1434394354979-a235cd36269d?auto=format&fit=crop&w=900&q=60' }}
            style={styles.headerBackground}
          />
          <Pressable onPress={pickImage} style={styles.profilePictureContainer}>
              <ExpoImage 
                source={{ uri: getImageUrl(profilePicture) }} 
                style={styles.profileImage}
                contentFit="cover"
                transition={500}
              />
              <View style={styles.editBadge}>
                <ThemedText style={styles.editBadgeText}>✎</ThemedText>
              </View>
          </Pressable>
        </View>
        
        <View style={styles.userInfoContainer}>
          <ThemedText style={styles.userName}>{username}</ThemedText>
          <ThemedText style={styles.userEmail}>{email}</ThemedText>
        </View>

        {friendRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <ThemedText style={styles.sectionTitle}>Friend Requests ({friendRequests.length})</ThemedText>
            {friendRequests.map((req) => (
              <View key={req._id} style={[styles.requestItem, { backgroundColor: colors.icon + '20' }]}>
                <ExpoImage 
                  source={{ uri: getImageUrl(req.from?.profilePicture) }} 
                  style={styles.requestAvatar} 
                />
                <ThemedText style={styles.requestName}>{req.from.username}</ThemedText>
                <View style={styles.requestActions}>
                  <Pressable onPress={() => handleRequestAction(req._id, 'accept')} style={styles.acceptBtn}>
                    <ThemedText style={styles.btnText}>✓</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => handleRequestAction(req._id, 'decline')} style={styles.declineBtn}>
                    <ThemedText style={styles.btnText}>✕</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.formContainer}>
          <ThemedText style={styles.sectionTitle}>Update Info</ThemedText>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
            placeholder="Username"
            placeholderTextColor={colors.icon}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <StyledButton title="Save Changes" onPress={() => handleUpdateProfile()} style={styles.updateButton} />

          <View style={styles.buttonContainer}>
              <ThemedText style={[styles.logoutButton, { color: colors.tint }]} onPress={handleLogout}>
                  Logout
              </ThemedText>
              <ThemedText style={[styles.deleteButton, { color: colors.tint }]} onPress={handleDeleteAccount}>
                  Delete Account
              </ThemedText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    scrollViewContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    headerContainer: {
        height: 180,
        marginBottom: 20,
    },
    headerBackground: {
        width: '100%',
        height: 120,
    },
    profilePictureContainer: {
        position: 'absolute',
        top: 70,
        left: 20,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#007AFF',
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    editBadgeText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    userInfoContainer: {
        alignItems: 'center',
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    userName: {
        fontSize: 26,
        fontWeight: 'bold',
    },
    userEmail: {
        fontSize: 16,
        color: 'gray',
    },
    requestsSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
    },
    requestItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 12,
      marginBottom: 8,
    },
    requestAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    requestName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
    },
    requestActions: {
      flexDirection: 'row',
    },
    acceptBtn: {
      backgroundColor: '#34C759',
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },
    declineBtn: {
      backgroundColor: '#FF3B30',
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },
    btnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    formContainer: {
        paddingHorizontal: 20,
    },
    input: {
        width: '100%',
        padding: 15,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 15,
    },
    updateButton: {
      width: '100%',
    },
    buttonContainer: {
        marginTop: 30,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingBottom: 40,
    },
    logoutButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    deleteButton: {
        fontSize: 16,
        fontWeight: '600',
        opacity: 0.7,
    },
});
