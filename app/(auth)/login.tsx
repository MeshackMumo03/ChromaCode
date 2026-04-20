import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, Image, ScrollView, View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledButton } from '@/components/StyledButton';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, googleLogin, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '292338562017-1iil6e508ucq148ogasibc5bql6r3uf2.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const success = await login(email, password);
    if (!success) {
      // Error handling is mostly managed in AuthProvider (redirect to verify etc)
      Alert.alert('Login Failed', 'Invalid credentials or network error.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      
      // To ensure the user is prompted to select an account, we can sign out first
      // This is common in apps where users might want to switch accounts frequently
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore errors from sign out if already signed out
      }

      const response = await GoogleSignin.signIn();
      
      // Handle both v13 (response.data.user) and older versions (response.user)
      const user = response.data ? response.data.user : (response as any).user;
      
      if (!user) {
        throw new Error('No user data returned from Google');
      }

      const success = await googleLogin({
        email: user.email,
        username: user.name,
        profilePicture: user.photo,
      });

      if (success) {
        Alert.alert('Success', 'Logged in with Google!');
      } else {
        Alert.alert('Error', 'Failed to authenticate with Google');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation in progress
      } else {
        console.error('Google Sign-In Error:', error);
        Alert.alert('Error', 'Google Sign-In failed');
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedView style={styles.container}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
          <ThemedText style={styles.title}>Welcome Back</ThemedText>
          
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
          
          <StyledButton title="Login" onPress={handleLogin} isLoading={isLoading} style={styles.button} />

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.icon }]} />
            <ThemedText style={styles.dividerText}>OR</ThemedText>
            <View style={[styles.divider, { backgroundColor: colors.icon }]} />
          </View>

          <TouchableOpacity 
            style={[styles.googleButton, { borderColor: colors.icon }]} 
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color={colors.text} style={{ marginRight: 10 }} />
            <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.linkContainer}>
            <ThemedText style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={{ color: colors.tint, fontWeight: 'bold' }}>Sign Up</Text>
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: '100%',
    marginTop: 10,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
    opacity: 0.5,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    marginTop: 10,
    padding: 10,
  },
  linkText: {
    fontSize: 16,
  },
});
