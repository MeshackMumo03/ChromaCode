import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyledButton } from '@/components/StyledButton';
import { useToast } from '@/hooks/useToast';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyEmail, isLoading } = useAuth();
  const [code, setCode] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { showToast } = useToast();

  const handleVerify = async () => {
    if (code.length !== 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }

    const success = await verifyEmail(email, code);
    if (success) {
      showToast('Email verified successfully!', 'success');
      // router.replace handles transition in useAuth
    } else {
      showToast('Invalid or expired code', 'error', 'Verification Failed');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>Verify Email</ThemedText>
        <ThemedText style={styles.subtitle}>
          We sent a 6-digit code to {email}. Please enter it below to verify your account.
        </ThemedText>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
          placeholder="000000"
          placeholderTextColor={colors.icon}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <StyledButton
          title="Verify Account"
          onPress={handleVerify}
          isLoading={isLoading}
          style={styles.button}
        />

        <ThemedText 
          style={[styles.link, { color: colors.tint }]}
          onPress={() => router.back()}
        >
          Back to Register
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
    height: 60,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 30,
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
