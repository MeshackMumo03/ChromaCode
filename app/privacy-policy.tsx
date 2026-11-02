import { ThemedText } from '@/components/themed-text';
import { getReleaseNote } from '@/constants/releaseNotes';
import { Colors } from '@/constants/theme';
import { APP_VERSION } from '@/constants/version';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const releaseNote = getReleaseNote(APP_VERSION);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'Privacy & Release Notes',
          headerShown: true,
          headerTintColor: colors.tint,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
        }}
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Version Badge */}
        <View style={[styles.versionCard, { backgroundColor: isDark ? '#1C1C28' : '#F0F4FF', borderColor: colors.tint + '40' }]}>
          <Ionicons name="shield-checkmark" size={32} color={colors.tint} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.versionTitle, { color: colors.text }]}>
              ChromaCode Security & Privacy
            </ThemedText>
            <ThemedText style={[styles.versionSub, { color: colors.icon }]}>
              Version {APP_VERSION}
            </ThemedText>
          </View>
        </View>

        {/* What's New Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            What&apos;s New in Version {APP_VERSION}
          </ThemedText>
          <View style={[styles.logBox, { backgroundColor: isDark ? '#1A1A26' : '#F8F9FA', borderColor: colors.icon + '20' }]}>
            {releaseNote.bullets.map((bullet, index) => (
              <ThemedText key={index} style={[styles.logItem, { color: colors.text }]}>
                • {bullet}
              </ThemedText>
            ))}
          </View>
        </View>

        {/* Privacy Policy Principles */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            🔒 Data Protection & Security Guidelines
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>1. Information We Collect</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            Your username, email address and password (stored only as a bcrypt hash), your profile picture and banner, the messages, photos, videos, voice notes and files you send, your colour codes and code history, your friends and blocked users, and a push notification token for your device.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>2. Signing In with Google</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            If you sign in with Google, we receive your name, email address and profile photo from Google. Every sign-in is verified directly with Google before you are logged in. We do not get access to your Google password or any other Google data.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>3. How We Protect Your Data</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            The text of your messages is encrypted in our database with AES-256-GCM. All traffic between the app and our servers uses HTTPS/TLS. Passwords are hashed with bcrypt, and our servers apply rate limiting and input sanitisation to block abuse. Photos, videos and files you send are stored with Cloudinary, and anyone who has the link to one of them can open it.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>4. Real-Time Messaging</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            Live chat connections only deliver a conversation&apos;s messages to its members. Push notifications are not sent while you are active in the app.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>5. Services We Use</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            We rely on these providers to run ChromaCode: MongoDB Atlas (database), Render (our server), Cloudinary (photos, videos and files), Brevo (verification and password-reset emails), Google (Sign in with Google) and Expo (app updates and push notifications). Each only receives the data it needs for its part.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>6. Your Controls & Account Deletion</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            You can block users, clear cached data, and delete your account from your Profile at any time. Deleting your account permanently removes your profile, every message you have sent (including in group chats), your direct chats, your colour codes and history, and your photos and files. This cannot be undone.
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.closeBtnText}>Return to App</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 20,
  },
  versionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  versionSub: {
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  logBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  logItem: {
    fontSize: 13,
    lineHeight: 20,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
  },
  closeBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
