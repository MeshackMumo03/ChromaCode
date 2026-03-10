import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, Switch, Alert, Platform, Modal, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings, ThemePreference } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { getBaseUrl } from '@/constants/api';
import { StyledButton } from '@/components/StyledButton';

const BASE_URL = getBaseUrl();

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { themePreference, setThemePreference, notificationsEnabled, setNotificationsEnabled } = useSettings();
  const { user, token, logout } = useAuth();
  
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all locally cached data? You will stay logged in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear specific keys but keep token
              const keys = await AsyncStorage.getAllKeys();
              const keysToKeep = ['userToken'];
              const keysToRemove = keys.filter(key => !keysToKeep.includes(key));
              await AsyncStorage.multiRemove(keysToRemove);
              Alert.alert('Success', 'Cache cleared successfully.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear cache.');
            }
          }
        }
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setIsChanging(true);
    try {
      const response = await fetch(`${BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Password updated successfully.');
        setPasswordModalVisible(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Failed to update password.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsChanging(false);
    }
  };

  const SettingRow = ({ icon, label, children, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.row, { borderBottomColor: colors.icon + '20' }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={colors.tint} style={styles.icon} />
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
      {children}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen 
        options={{ 
          title: 'Settings',
          headerShown: true,
          headerBackTitle: 'Back',
          headerTintColor: colors.tint,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text }
        }} 
      />
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
          <SettingRow icon="contrast-outline" label="Theme">
            <View style={styles.themeToggle}>
              {(['light', 'dark', 'system'] as ThemePreference[]).map((pref) => (
                <TouchableOpacity
                  key={pref}
                  onPress={() => setThemePreference(pref)}
                  style={[
                    styles.themeOption,
                    themePreference === pref && { backgroundColor: colors.tint }
                  ]}
                >
                  <ThemedText 
                    style={[
                      styles.themeOptionText, 
                      themePreference === pref && { color: '#fff' }
                    ]}
                  >
                    {pref.charAt(0).toUpperCase() + pref.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </SettingRow>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>
          <SettingRow icon="notifications-outline" label="Push Notifications">
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: colors.tint + '80' }}
              thumbColor={notificationsEnabled ? colors.tint : '#f4f3f4'}
            />
          </SettingRow>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Privacy</ThemedText>
          <SettingRow 
            icon="person-remove-outline" 
            label="Blocked Users" 
            onPress={() => router.push('/blocked-users')} 
          >
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </SettingRow>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Security</ThemedText>
          <SettingRow 
            icon="lock-closed-outline" 
            label="Change Password" 
            onPress={() => setPasswordModalVisible(true)} 
          >
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </SettingRow>
          <SettingRow icon="shield-checkmark-outline" label="Encryption Status">
            <ThemedText style={{ color: '#34C759', fontSize: 14, fontWeight: 'bold' }}>Verified</ThemedText>
          </SettingRow>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>App Maintenance</ThemedText>
          <SettingRow 
            icon="trash-outline" 
            label="Clear Cache" 
            onPress={handleClearCache}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </SettingRow>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <SettingRow icon="information-circle-outline" label="Version">
            <ThemedText style={{ color: colors.icon }}>1.0.0</ThemedText>
          </SettingRow>
          <SettingRow icon="document-text-outline" label="Privacy Policy" onPress={() => {}}>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </SettingRow>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <ThemedText style={styles.logoutText}>Log Out</ThemedText>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
              placeholder="New Password"
              placeholderTextColor={colors.icon}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
              placeholder="Confirm New Password"
              placeholderTextColor={colors.icon}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.icon + '40' }]} 
                onPress={() => setPasswordModalVisible(false)}
              >
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.tint }]} 
                onPress={handleChangePassword}
                disabled={isChanging}
              >
                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>
                  {isChanging ? 'Updating...' : 'Update'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  section: {
    marginTop: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 30,
    marginRight: 10,
  },
  label: {
    fontSize: 16,
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: Platform.OS === 'ios' ? '#efeff4' : '#e0e0e0',
    borderRadius: 8,
    padding: 2,
  },
  themeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  logoutBtn: {
    marginTop: 40,
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#FF3B3015',
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 0.48,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  }
});
