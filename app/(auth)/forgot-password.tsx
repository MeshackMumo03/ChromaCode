import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, Href } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyledButton } from '@/components/StyledButton';
import { useToast } from '@/hooks/useToast';

export default function ForgotPasswordScreen() {
  const { forgotPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { showToast } = useToast();

  const handleSendCode = async () => {
    if (!email) {
      showToast('Please enter your email address', 'error');
      return;
    }

    const success = await forgotPassword(email);
    if (success) {
      showToast(
        'If an account exists for that email, a password reset code has been sent to it.',
        'success',
        'Check Your Email'
      );
      router.push({ pathname: '/reset-password' as any, params: { email } });
    } else {
      showToast('Something went wrong. Please check your connection and try again.', 'error');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>Forgot Password</ThemedText>
        <ThemedText style={styles.subtitle}>
          Enter the email address linked to your account. We&apos;ll send you a code to reset your password.
        </ThemedText>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
          placeholder="Email"
          placeholderTextColor={colors.icon}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <StyledButton
          title="Send Reset Code"
          onPress={handleSendCode}
          isLoading={isLoading}
          style={styles.button}
        />

        <ThemedText
          style={[styles.link, { color: colors.tint }]}
          onPress={() => router.back()}
        >
          Back to Login
        </ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.7,
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    width: '100%',
    marginBottom: 20,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
  },
});
