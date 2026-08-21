import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Only import GoogleSignin if not in Expo Go to avoid crashes
let GoogleSignin: any = null;
let statusCodes: any = null;

if (Constants.appOwnership !== 'expo') {
  try {
    const GoogleModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleModule.GoogleSignin;
    statusCodes = GoogleModule.statusCodes;
  } catch (e) {
    console.log('Google Sign-in not available');
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, googleLogin, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isExpoGo = Constants.appOwnership === 'expo';
  const { showToast } = useToast();

  useEffect(() => {
    if (GoogleSignin) {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!webClientId) {
        // Don't let a missing/misconfigured env var crash the whole app on
        // mount — just skip configuring Google Sign-In. The Google button
        // will simply fail gracefully (see handleGoogleSignIn's guard)
        // instead of taking down the entire app.
        console.warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set; Google Sign-In will be unavailable.');
        return;
      }
      try {
        GoogleSignin.configure({
          webClientId,
        });
      } catch (e) {
        console.warn('GoogleSignin.configure failed:', e);
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    const success = await login(email, password);
    if (!success) {
      // Error handling is mostly managed in AuthProvider (redirect to verify etc)
      showToast('Invalid credentials or network error.', 'error', 'Login Failed');
    }
  };

  const handleGoogleSignIn = async () => {
    if (isExpoGo) {
      showToast('Google Sign-In is not supported in Expo Go. Please use a development build.', 'error', 'Not Supported');
      return;
    }

    if (!GoogleSignin) return;

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

      // Handle both v13 (response.data) and older versions (response)
      const signInData = response.data ? response.data : (response as any);
      const user = signInData.user;
      let idToken = signInData.idToken;

      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        throw new Error('Could not retrieve Google ID token');
      }

      if (!user) {
        throw new Error('No user data returned from Google');
      }

      const success = await googleLogin(idToken);

      if (success) {
        showToast('Logged in with Google!', 'success');
      } else {
        showToast('Failed to authenticate with Google', 'error');
      }
    } catch (error: any) {
      if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
        // operation in progress
      } else {
        console.error('Google Sign-In Error:', error);
        showToast('Google Sign-In failed', 'error');
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

          <TouchableOpacity onPress={() => router.push('/forgot-password' as Href)} style={styles.forgotPasswordContainer}>
            <ThemedText style={[styles.forgotPasswordText, { color: colors.tint }]}>
              Forgot Password?
            </ThemedText>
          </TouchableOpacity>

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
              Don&apos;t have an account?{' '}
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
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
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
