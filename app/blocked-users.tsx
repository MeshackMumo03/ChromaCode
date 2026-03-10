import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Alert, View, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { getBaseUrl } from '@/constants/api';

const BASE_URL = getBaseUrl();

export default function BlockedUsersScreen() {
  const { token, user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const fetchBlockedUsers = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setBlockedUsers(data.blockedUsers || []);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleUnblock = async (userId: string) => {
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
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        Alert.alert('Success', 'User unblocked successfully.');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBlockedUsers();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen 
          options={{ 
            title: 'Blocked Users',
            headerShown: true,
            headerTintColor: colors.tint,
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { color: colors.text }
          }} 
        />
        
        {blockedUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="person-remove-outline" size={60} color={colors.icon} />
            <ThemedText style={styles.emptyText}>No blocked users.</ThemedText>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.tint]} tintColor={colors.tint} />}
            renderItem={({ item }) => (
              <View style={[styles.userItem, { borderBottomColor: colors.icon + '20' }]}>
                <View style={styles.userInfo}>
                  <Ionicons name="person-circle-outline" size={40} color={colors.icon} />
                  <ThemedText style={styles.userIdText}>User ID: {item.substring(0, 8)}...</ThemedText>
                </View>
                <TouchableOpacity 
                  style={[styles.unblockBtn, { backgroundColor: colors.tint }]} 
                  onPress={() => handleUnblock(item)}
                >
                  <ThemedText style={styles.unblockBtnText}>Unblock</ThemedText>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    opacity: 0.6,
  },
  listContainer: {
    padding: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIdText: {
    marginLeft: 10,
    fontSize: 16,
  },
  unblockBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
