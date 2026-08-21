import { ThemedText } from '@/components/themed-text';
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
              Version {APP_VERSION} (Runtime 1.0.0)
            </ThemedText>
          </View>
        </View>

        {/* What's New in v{APP_VERSION} Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            What's New in Version {APP_VERSION}
          </ThemedText>
          <View style={[styles.logBox, { backgroundColor: isDark ? '#1A1A26' : '#F8F9FA', borderColor: colors.icon + '20' }]}>
            <ThemedText style={[styles.logItem, { color: colors.text }]}>
              • <ThemedText style={{ fontWeight: 'bold' }}>Encrypted Messaging:</ThemedText> Messages are now encrypted end-to-end before storage and decrypted on the device.
            </ThemedText>
            <ThemedText style={[styles.logItem, { color: colors.text }]}>
              • <ThemedText style={{ fontWeight: 'bold' }}>Media Uploads:</ThemedText> Send images, videos, audio and documents securely via Cloudinary URLs instead of base64-in-MongoDB.
            </ThemedText>
            <ThemedText style={[styles.logItem, { color: colors.text }]}>
              • <ThemedText style={{ fontWeight: 'bold' }}>Profile Banner:</ThemedText> Upload a custom banner image to your profile.
            </ThemedText>
            <ThemedText style={[styles.logItem, { color: colors.text }]}>
              • <ThemedText style={{ fontWeight: 'bold' }}>Multi-Device Presence:</ThemedText> One user can be signed in on multiple devices at once; self-notifications are suppressed while online.
            </ThemedText>
            <ThemedText style={[styles.logItem, { color: colors.text }]}>
              • <ThemedText style={{ fontWeight: 'bold' }}>Socket Security:</ThemedText> Socket.io connections now require authentication and only allow joining rooms you are a member of.
            </ThemedText>
            <ThemedText style={[styles.logItem, { color: colors.text }]}>
              • <ThemedText style={{ fontWeight: 'bold' }}>Bot Signals:</ThemedText> A dedicated bot user (botsignals) can receive and report signals from the Py-bot sidecar.
            </ThemedText>
          </View>
        </View>

        {/* Privacy Policy Principles */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            🔒 Data Protection & Security Guidelines
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>1. Information We Collect</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            We collect your account username, email address, profile picture, and encrypted custom color codes. Push tokens are stored securely and associated exclusively with your active session to prevent notification leaks across accounts.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>2. How We Protect Your Data</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            In accordance with top cyber security expert standards, passwords are hashed with bcrypt, API endpoints enforce rate-limiting and NoSQL injection sanitisation (mongo-sanitize), and all network requests operate over TLS/HTTPS encryption.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>3. Real-Time Socket Security</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            Socket.io channels are restricted to verified participant user IDs. Push notifications are automatically suppressed when your device is active online to preserve real-time privacy.
          </ThemedText>

          <ThemedText style={[styles.heading, { color: colors.text }]}>4. Your Controls & Data Deletion</ThemedText>
          <ThemedText style={[styles.paragraph, { color: colors.icon }]}>
            You can clear local cached data, block unwanted users, or permanently delete your account and associated messages directly from the Profile settings at any time.
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
