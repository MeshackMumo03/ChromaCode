import { StyledButton } from "@/components/StyledButton";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from 'expo-constants';

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

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { register, googleLogin, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    if (GoogleSignin) {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!webClientId) {
        console.warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set; Google Sign-In will be unavailable.');
        return;
      }
      try {
        GoogleSignin.configure({
          webClientId,
          offlineAccess: true,
        });
      } catch (e) {
        console.warn('GoogleSignin.configure failed:', e);
      }
    }
  }, []);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    const result: any = await register(username, email, password);
    if (result.success) {
      if (result.needsVerification) {
        Alert.alert(
          "Success",
          "Verification code sent! Please check your email.",
        );
        router.push({
          pathname: "/verify-email",
          params: { email: result.email },
        });
      } else {
        router.replace("/(tabs)");
      }
    } else {
      Alert.alert(
        "Registration Failed",
        "User already exists or network error.",
      );
    }
  };

  const handleGoogleSignIn = async () => {
    if (isExpoGo) {
      Alert.alert('Not Supported', 'Google Sign-In is not supported in Expo Go. Please use a development build.');
      return;
    }

    if (!GoogleSignin) return;

    try {
      await GoogleSignin.hasPlayServices();

      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore errors
      }

      const response = await GoogleSignin.signIn();

      // Handle both v13 (response.data.user) and older versions (response.user)
      const user = response.data ? response.data.user : (response as any).user;

      if (!user) {
        throw new Error("No user data returned from Google");
      }

      const success = await googleLogin({
        email: user.email,
        username: user.name,
        profilePicture: user.photo,
      });

      if (success) {
        Alert.alert("Success", "Logged in with Google!");
      } else {
        Alert.alert("Error", "Failed to authenticate with Google");
      }
    } catch (error: any) {
      if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
        // operation in progress
      } else {
        console.error("Google Sign-In Error:", error);
        Alert.alert("Error", "Google Sign-In failed");
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedView style={styles.container}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
          />
          <ThemedText style={styles.title}>Create Account</ThemedText>

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.icon,
                backgroundColor: colors.background,
              },
            ]}
            placeholder="Username"
            placeholderTextColor={colors.icon}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.icon,
                backgroundColor: colors.background,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.icon}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.icon,
                backgroundColor: colors.background,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.icon}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <StyledButton
            title="Sign Up"
            onPress={handleRegister}
            isLoading={isLoading}
            style={styles.button}
          />

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
            <Ionicons
              name="logo-google"
              size={20}
              color={colors.text}
              style={{ marginRight: 10 }}
            />
            <ThemedText style={styles.googleButtonText}>
              Continue with Google
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.linkContainer}>
            <ThemedText style={styles.linkText}>
              Already have an account?{' '}
              <Text style={{ color: colors.tint, fontWeight: 'bold' }}>Login</Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    paddingBottom: 40, // Extra padding at bottom
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: "100%",
    marginTop: 10,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
    width: "100%",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 55,
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 30, // More space after google button
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  linkContainer: {
    marginTop: 10,
    padding: 10,
  },
  linkText: {
    fontSize: 16,
  },
});
