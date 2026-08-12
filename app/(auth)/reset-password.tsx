import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyledButton } from '@/components/StyledButton';
import { useToast } from '@/hooks/useToast';

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resetPassword, forgotPassword, isLoading } = useAuth();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { showToast } = useToast();

  const handleReset = async () => {
    if (code.length !== 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    const success = await resetPassword(email, code, newPassword);
    if (success) {
      showToast('Your password has been reset!', 'success');
      // router.replace to (tabs) is handled inside useAuth's resetPassword
    } else {
      showToast('Invalid or expired code. Please try again.', 'error', 'Reset Failed');
    }
  };

  const handleResend = async () => {
    const success = await forgotPassword(email);
    if (success) {
      showToast('A new reset code has been sent to your email.', 'info', 'Code Sent');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>Reset Password</ThemedText>
        <ThemedText style={styles.subtitle}>
          Enter the 6-digit code we sent to {email}, then choose a new password.
        </ThemedText>

        <TextInput
          style={[styles.codeInput, { color: colors.text, borderColor: colors.icon }]}
          placeholder="000000"
          placeholderTextColor={colors.icon}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
          placeholder="New Password"
          placeholderTextColor={colors.icon}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon, backgroundColor: colors.background }]}
          placeholder="Confirm New Password"
          placeholderTextColor={colors.icon}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <StyledButton
          title="Reset Password"
          onPress={handleReset}
          isLoading={isLoading}
          style={styles.button}
        />

        <ThemedText
          style={[styles.link, { color: colors.tint }]}
          onPress={handleResend}
        >
          Didn&apos;t get a code? Resend
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
  codeInput: {
    width: '100%',
    height: 60,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 10,
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
  button: {
    width: '100%',
    marginTop: 5,
    marginBottom: 20,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
  },
});
