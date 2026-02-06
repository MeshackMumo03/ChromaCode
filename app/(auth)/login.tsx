import React, { useState } from 'react';
import { StyleSheet, TextInput, Button, Alert, Image } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    const success = await login(email, password);
    if (success) {
      router.replace('/');
    } else {
      Alert.alert('Login Failed', 'Invalid credentials or network error.');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <ThemedText style={[styles.title, { color: colors.text }]}>Login</ThemedText>
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
      <Button title={isLoading ? 'Logging In...' : 'Login'} onPress={handleLogin} disabled={isLoading} color={colors.tint} />
      <ThemedText style={[styles.link, { color: colors.tint }]} onPress={() => router.push('/register')}>
        Don&apos;t have an account? Register
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
