import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, Alert, TouchableOpacity, View, ActivityIndicator, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaseUrl, getImageUrl } from '@/constants/api';
import { StyledButton } from '@/components/StyledButton';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useToast } from '@/hooks/useToast';

const BASE_URL = getBaseUrl();

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [conversation, setConversation] = useState<any>(null);
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showToast } = useToast();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const fetchGroupDetails = useCallback(async () => {
    if (!token || !id) return;
    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setConversation(data.conversation);
        setGroupName(data.conversation.name || '');
        setGroupImage(data.conversation.groupImage || '');
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchGroupDetails();
  }, [fetchGroupDetails]);

  const isAdmin = conversation?.groupAdmin === user?._id || conversation?.groupAdmin?._id === user?._id;

  const handleUpdateGroup = async (newImage?: string) => {
    if (!token) return;
    setSaving(true);
    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}/group`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: groupName,
          groupImage: newImage !== undefined ? newImage : groupImage 
        }),
      });
      
      const data = await response.json();
      if (response.ok) {
        if (!newImage) showToast('Group updated successfully', 'success');
        setConversation(data);
      } else {
        showToast(data.message || 'Failed to update group', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadToBackend = async (uri: string) => {
    setSaving(true);
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'group.jpg',
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
        setGroupImage(data.imageUrl);
        handleUpdateGroup(data.imageUrl);
      } else {
        console.error('Backend upload error:', data);
        showToast(data.message || 'Could not upload image.', 'error', 'Upload Failed');
      }
    } catch (error) {
      console.error('Backend upload error:', error);
      showToast('Could not upload image to server.', 'error', 'Upload Failed');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    if (!isAdmin) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('We need camera roll permissions to change the group image.', 'error', 'Permission Denied');
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

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/conversations/${id}/leave`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                router.replace('/conversations');
              } else {
                const data = await response.json();
                showToast(data.message || 'Could not leave group', 'error');
              }
            } catch (error) {
              showToast('Failed to leave group', 'error');
            }
          }
        }
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This will remove everyone and delete all messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/conversations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                router.replace('/conversations');
              } else {
                const data = await response.json();
                showToast(data.message || 'Could not delete group', 'error');
              }
            } catch (error) {
              showToast('Failed to delete group', 'error');
            }
          }
        }
      ]
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.tint} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchGroupDetails} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Group Settings</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.avatarSection}>
          <Pressable onPress={pickImage} style={styles.imageContainer}>
            <ExpoImage 
              source={{ uri: getImageUrl(groupImage) || 'https://cdn-icons-png.flaticon.com/512/166/166258.png' }} 
              style={styles.largeAvatar} 
            />
            {isAdmin && (
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </Pressable>
          
          {isAdmin ? (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomColor: colors.tint }]}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Group Name"
              />
              <TouchableOpacity onPress={() => handleUpdateGroup()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.tint} /> : 
                  <Ionicons name="checkmark-circle" size={28} color={colors.tint} />}
              </TouchableOpacity>
            </View>
          ) : (
            <ThemedText style={styles.groupNameText}>{groupName}</ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Participants ({conversation?.participants.length})</ThemedText>
          {conversation?.participants.map((p: any) => (
            <View key={p._id} style={styles.participantItem}>
              <ExpoImage
                source={{ uri: getImageUrl(p.profilePicture) }}
                style={styles.smallAvatar}
                contentFit="cover"
              />
              <ThemedText style={styles.participantName}>{p.username}</ThemedText>
              {(conversation.groupAdmin === p._id || conversation.groupAdmin?._id === p._id) && (
                <View style={[styles.adminBadge, { backgroundColor: colors.tint + '20' }]}>
                  <ThemedText style={[styles.adminBadgeText, { color: colors.tint }]}>Admin</ThemedText>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLeaveGroup}>
            <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
            <ThemedText style={[styles.actionText, { color: '#FF3B30' }]}>Leave Group</ThemedText>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteGroup}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <ThemedText style={[styles.actionText, { color: '#FF3B30' }]}>Delete Group</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  avatarSection: {
    alignItems: 'center',
    padding: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  groupNameText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    borderBottomWidth: 2,
    paddingBottom: 5,
    marginRight: 10,
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    opacity: 0.6,
    marginBottom: 15,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  participantName: {
    fontSize: 16,
    flex: 1,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionSection: {
    marginTop: 20,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15,
  },
});
