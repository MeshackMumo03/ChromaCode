import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, FlatList, Alert, View, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { getBaseUrl, getImageUrl } from '@/constants/api';
import { Image as ExpoImage } from 'expo-image';
import { useToast } from '@/hooks/useToast';

const BASE_URL = getBaseUrl();

export default function BlockedUsersScreen() {
  const { token, user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const navigation = useNavigation();
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch profile for blocked users (ids)
      const profileRes = await fetch(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const profileData = await profileRes.json();
      
      // Fetch detailed list of all users to resolve blocked user details 
      // OR if the backend supports it, we could have a specific endpoint.
      // For now, let's fetch friends to show users that CAN be blocked.
      const friendsRes = await fetch(`${BASE_URL}/users/friends`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const friendsData = await friendsRes.json();

      if (profileRes.ok) {
        // Blocked users are just IDs in the user model currently
        const blockedIds = profileData.blockedUsers || [];
        
        // Filter friends to only those NOT blocked
        const blockableFriends = friendsData.filter((f: any) => !blockedIds.includes(f._id));
        
        // We'll also try to resolve names for blocked users from friends list if they were friends
        const blockedWithDetails = blockedIds.map((id: string) => {
          const found = friendsData.find((f: any) => f._id === id);
          return found || { _id: id, username: `User ${id.substring(0, 5)}` };
        });

        setBlockedUsers(blockedWithDetails);
        setFriends(blockableFriends);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Manage Privacy',
      headerShown: true,
      headerTintColor: colors.tint,
      headerStyle: { backgroundColor: colors.background },
      headerTitleStyle: { color: colors.text }
    });
  }, [navigation, colors]);

  const handleBlock = async (userId: string, username: string) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${username}? They will no longer be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/users/block`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ userIdToBlock: userId }),
              });

              if (response.ok) {
                showToast(`${username} has been blocked.`, 'success');
                fetchData();
              } else {
                const data = await response.json();
                showToast(data.message || 'Failed to block user', 'error');
              }
            } catch (error) {
              console.error('Error blocking user:', error);
            }
          }
        }
      ]
    );
  };

  const handleUnblock = async (userId: string, username: string) => {
    try {
      const response = await fetch(`${BASE_URL}/users/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userIdToUnblock: userId }),
      });

      if (response.ok) {
        showToast(`${username} unblocked.`, 'success');
        fetchData();
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.tint]} tintColor={colors.tint} />}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Blocked Users</ThemedText>
          {blockedUsers.length === 0 ? (
            <ThemedText style={styles.emptyText}>No users blocked.</ThemedText>
          ) : (
            blockedUsers.map((item) => (
              <View key={item._id} style={[styles.userItem, { borderBottomColor: colors.icon + '20' }]}>
                <View style={styles.userInfo}>
                  <ExpoImage 
                    source={{ uri: getImageUrl(item.profilePicture) }} 
                    style={styles.avatar} 
                  />
                  <ThemedText style={styles.userName}>{item.username}</ThemedText>
                </View>
                <TouchableOpacity 
                  style={[styles.unblockBtn, { borderColor: colors.tint, borderWidth: 1 }]} 
                  onPress={() => handleUnblock(item._id, item.username)}
                >
                  <ThemedText style={[styles.unblockBtnText, { color: colors.tint }]}>Unblock</ThemedText>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <ThemedText style={styles.sectionTitle}>Friends (Can be blocked)</ThemedText>
          {friends.length === 0 ? (
            <ThemedText style={styles.emptyText}>No friends to block.</ThemedText>
          ) : (
            friends.map((item) => (
              <View key={item._id} style={[styles.userItem, { borderBottomColor: colors.icon + '20' }]}>
                <View style={styles.userInfo}>
                  <ExpoImage 
                    source={{ uri: getImageUrl(item.profilePicture) }} 
                    style={styles.avatar} 
                  />
                  <ThemedText style={styles.userName}>{item.username}</ThemedText>
                </View>
                <TouchableOpacity 
                  style={[styles.blockBtn, { backgroundColor: '#FF3B30' }]} 
                  onPress={() => handleBlock(item._id, item.username)}
                >
                  <ThemedText style={styles.blockBtnText}>Block</ThemedText>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unblockBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  blockBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  blockBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
