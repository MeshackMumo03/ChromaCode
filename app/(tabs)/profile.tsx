import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getBaseUrl, getImageUrl } from '@/constants/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { uploadFileToEndpoint } from '@/utils/uploadFile';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = getBaseUrl();

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');
  const [banner, setBanner] = useState(user?.banner || '');
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();

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
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
    });
  }, [navigation, colors.text, colors.background]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setProfilePicture(user.profilePicture);
      setBanner(user.banner || '');
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

  const handleUpdateProfile = async (updates?: { profilePicture?: string; banner?: string }) => {
    if (!token) {
      showToast('Not authenticated.', 'error');
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
          profilePicture: updates?.profilePicture ?? profilePicture,
          banner: updates?.banner ?? banner,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (!updates) showToast('Profile updated successfully.', 'success');
        updateUser(data.user);
      } else {
        showToast(data.message || 'Could not update profile.', 'error');
      }
    } catch (error) {
      showToast('Network error during profile update.', 'error');
    }
  };

  const uploadToBackend = async (uri: string, fileName?: string, mimeType?: string) => {
    setRefreshing(true);
    try {
      const data = await uploadFileToEndpoint(
        `${BASE_URL}/users/upload`,
        uri,
        'image',
        token,
        fileName || 'avatar.jpg',
        mimeType || 'image/jpeg',
      );
      if (data?.imageUrl) {
        setProfilePicture(data.imageUrl);
        handleUpdateProfile({ profilePicture: data.imageUrl });
      } else {
        showToast(data?.message || 'Could not upload image.', 'error');
      }
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      showToast(error?.message || 'Could not upload image to server.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const uploadBanner = async (uri: string, fileName?: string, mimeType?: string) => {
    setUploadingBanner(true);
    try {
      const data = await uploadFileToEndpoint(
        `${BASE_URL}/users/upload`,
        uri,
        'image',
        token,
        fileName || 'banner.jpg',
        mimeType || 'image/jpeg',
      );
      if (data?.imageUrl) {
        setBanner(data.imageUrl);
        handleUpdateProfile({ banner: data.imageUrl });
      } else {
        showToast(data?.message || 'Could not upload banner.', 'error');
      }
    } catch (error: any) {
      console.error('Banner upload error:', error);
      showToast(error?.message || 'Could not upload banner to server.', 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Camera roll permissions required.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      uploadToBackend(asset.uri, asset.fileName || undefined, asset.mimeType || undefined);
    }
  };

  const pickBanner = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Camera roll permissions required.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      uploadBanner(asset.uri, asset.fileName || undefined, asset.mimeType || undefined);
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
        if (action === 'accept') showToast('Friend request accepted!', 'success');
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
    if (!token) return;

    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/users/profile`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.ok) {
                showToast('Account deleted.', 'success');
                logout();
              } else {
                const data = await response.json();
                showToast(data.message || 'Could not delete account.', 'error');
              }
            } catch (error) {
              showToast('Network error.', 'error');
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText>Please log in to view your profile.</ThemedText>
        <StyledButton title="Go to Login" onPress={() => router.replace('/login')} />
      </ThemedView>
    );
  }

  const cardBg = isDark ? '#1C1C1E' : '#F2F2F7';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerContainer}>
          <Pressable onPress={pickBanner} disabled={uploadingBanner}>
            {banner ? (
              <ExpoImage
                source={{ uri: getImageUrl(banner) }}
                style={styles.headerBackground}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View style={[styles.headerBackground, { backgroundColor: colors.tint + '80' }]} />
            )}
            <View style={[styles.bannerEditBadge, { backgroundColor: colors.tint }]}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          </Pressable>

          <View style={styles.profileSection}>
            <Pressable onPress={pickImage} style={[styles.profilePictureContainer, { borderColor: colors.background }]}>
                <ExpoImage 
                  source={{ uri: getImageUrl(profilePicture) }} 
                  style={styles.profileImage}
                  contentFit="cover"
                  transition={300}
                />
                <View style={[styles.editBadge, { backgroundColor: colors.tint, borderColor: colors.background }]}>
                  <Ionicons name="camera" size={14} color="#FFF" />
                </View>
            </Pressable>

            <View style={styles.userInfoContainer}>
              <View style={styles.nameRow}>
                <ThemedText style={styles.userName}>{username}</ThemedText>
                {user.isVerified && (
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" style={styles.verifiedIcon} />
                )}
              </View>
              
              <ThemedText style={styles.userEmail}>{email}</ThemedText>
              
              {!user.isVerified ? (
                <TouchableOpacity onPress={() => router.push('/settings')}>
                  <View style={[styles.statusChip, { backgroundColor: '#FF950020' }]}>
                    <ThemedText style={[styles.statusText, { color: '#FF9500' }]}>Unverified — Tap to fix</ThemedText>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.statusChip, { backgroundColor: '#34C75920' }]}>
                  <ThemedText style={[styles.statusText, { color: '#34C759' }]}>Verified Email</ThemedText>
                </View>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <ThemedText style={styles.statNumber}>{user.friends?.length || 0}</ThemedText>
                <ThemedText style={styles.statLabel}>Friends</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <ThemedText style={styles.statNumber}>-</ThemedText>
                <ThemedText style={styles.statLabel}>Chats</ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentContainer}>
          {friendRequests.length > 0 && (
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.sectionTitle}>Friend Requests ({friendRequests.length})</ThemedText>
              {friendRequests.map((req) => (
                <View key={req._id} style={styles.requestItem}>
                  <ExpoImage 
                    source={{ uri: getImageUrl(req.from?.profilePicture) }} 
                    style={styles.requestAvatar} 
                  />
                  <ThemedText style={styles.requestName}>{req.from.username}</ThemedText>
                  <View style={styles.requestActions}>
                    <Pressable onPress={() => handleRequestAction(req._id, 'accept')} style={styles.acceptBtn}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => handleRequestAction(req._id, 'decline')} style={styles.declineBtn}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.sectionTitle}>Edit Profile</ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
              <Ionicons name="person-outline" size={20} color={colors.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Username"
                placeholderTextColor={colors.icon}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
            <StyledButton title="Save Changes" onPress={() => handleUpdateProfile()} style={styles.updateButton} />
          </View>

          <View style={[styles.card, { backgroundColor: isDark ? '#2c1a1a' : '#fff0f0' }]}>
            <ThemedText style={[styles.sectionTitle, { color: '#FF3B30' }]}>Danger Zone</ThemedText>
            <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: isDark ? '#3d2424' : '#ffe5e5' }]} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <ThemedText style={styles.logoutText}>Log Out</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: isDark ? '#3d2424' : '#ffe5e5', marginTop: 10 }]} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <ThemedText style={styles.deleteText}>Delete Account</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerContainer: { alignItems: 'center', paddingBottom: 20 },
  headerBackground: { width: '100%', height: 140, position: 'absolute', top: 0 },
  bannerEditBadge: {
    position: 'absolute', top: 100, right: 16,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  profileSection: { alignItems: 'center', marginTop: 70, width: '100%' },
  profilePictureContainer: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8,
  },
  profileImage: { width: '100%', height: '100%', borderRadius: 60 },
  editBadge: {
    position: 'absolute', bottom: 0, right: 4,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3,
  },
  userInfoContainer: { alignItems: 'center', marginTop: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 24, fontWeight: '800' },
  verifiedIcon: { marginTop: 2 },
  userEmail: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 30 },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#8E8E93', opacity: 0.3 },
  contentContainer: { paddingHorizontal: 20, marginTop: 10, gap: 16 },
  card: { padding: 16, borderRadius: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 12, marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  updateButton: { width: '100%' },
  requestItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  requestAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  requestName: { flex: 1, fontSize: 15, fontWeight: '600' },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#34C759', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  declineBtn: { backgroundColor: '#FF3B30', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 10 },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
  deleteText: { color: '#FF3B30', fontSize: 16, fontWeight: '600', opacity: 0.9 },
});
