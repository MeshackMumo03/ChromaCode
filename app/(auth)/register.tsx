import React, { useState } from 'react';
import { StyleSheet, TextInput, Button, Alert, Image } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const success = await register(username, email, password);
    if (success) {
      router.replace('/');
    } else {
      Alert.alert('Registration Failed', 'User already exists or network error.');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <ThemedText style={[styles.title, { color: colors.text }]}>Register</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
        placeholder="Username"
        placeholderTextColor={colors.icon}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
        placeholder="Email"
        placeholderTextColor={colors.icon}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
        placeholder="Password"
        placeholderTextColor={colors.icon}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title={isLoading ? 'Registering...' : 'Register'} onPress={handleRegister} disabled={isLoading} color={colors.tint} />
      <ThemedText style={[styles.link, { color: colors.tint }]} onPress={() => router.push('/login')}>
        Already have an account? Login
      </ThemedText>
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
  logo: {
    width: 100,
    height: 100,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
  },
  link: {
    marginTop: 20,
  },
});
