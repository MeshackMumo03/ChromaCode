import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, Image, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledButton } from '@/components/StyledButton';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, googleLogin, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '292338562017-1iil6e508ucq148ogasibc5bql6r3uf2.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const result = await register(username, email, password);
    if (result.success) {
      if (result.needsVerification) {
        Alert.alert('Success', 'Verification code sent! Please check your email.');
        router.push({ pathname: '/verify-email', params: { email: result.email } });
      } else {
        router.replace('/(tabs)');
      }
    } else {
      Alert.alert('Registration Failed', 'User already exists or network error.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      const success = await googleLogin({
        email: userInfo.user.email,
        username: userInfo.user.name,
        profilePicture: userInfo.user.photo,
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
          <ThemedText style={styles.title}>Create Account</ThemedText>
          
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
          
          <StyledButton title="Sign Up" onPress={handleRegister} isLoading={isLoading} style={styles.button} />

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

          <ThemedText style={[styles.link, { color: colors.tint }]} onPress={() => router.push('/login')}>
            Already have an account? Login
          </ThemedText>
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
  link: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});
