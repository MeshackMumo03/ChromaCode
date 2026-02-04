import React, { useState } from 'react';
import { StyleSheet, TextInput, Button, Alert } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    const success = await login(email, password);
    if (success) {
      router.replace('/'); // Navigate to home screen or authenticated area
    } else {
      Alert.alert('Login Failed', 'Invalid credentials or network error.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Login</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title={isLoading ? 'Logging In...' : 'Login'} onPress={handleLogin} disabled={isLoading} />
      <ThemedText style={styles.link} onPress={() => router.push('/register')}>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: 'white', // Ensure visibility on themed background
  },
  link: {
    marginTop: 20,
    color: 'blue',
  },
});
