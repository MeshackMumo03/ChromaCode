import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = 'August 11, 2026';
const APP_VERSION = '1.0.0';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.iconBadge, { backgroundColor: colors.tint + '18' }]}>
          <Ionicons name={icon as any} size={20} color={colors.tint} />
        </View>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <ThemedText style={[styles.paragraph, { color: colors.text }]}>{children}</ThemedText>
  );
}

function BulletItem({ text }: { text: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: colors.tint }]} />
      <ThemedText style={[styles.bulletText, { color: colors.text }]}>{text}</ThemedText>
    </View>
  );
}

function InfoBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={[styles.infoBox, { backgroundColor: colors.icon + '12', borderColor: colors.icon + '25' }]}>
      <Ionicons name={icon as any} size={16} color={colors.tint} style={{ marginRight: 8 }} />
      <View>
        <ThemedText style={[styles.infoLabel, { color: colors.icon }]}>{label}</ThemedText>
        <ThemedText style={[styles.infoValue, { color: colors.text }]}>{value}</ThemedText>
      </View>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          headerShown: true,
          headerTintColor: colors.tint,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.tint + '12', borderColor: colors.tint + '25' }]}>
          <Ionicons name="shield-checkmark" size={44} color={colors.tint} style={{ marginBottom: 12 }} />
          <ThemedText style={[styles.heroTitle, { color: colors.text }]}>Your Privacy Matters</ThemedText>
          <ThemedText style={[styles.heroSub, { color: colors.icon }]}>
            This document explains how ChromaCode collects, uses, and protects your information.
          </ThemedText>
        </View>

        {/* Meta info */}
        <View style={styles.metaRow}>
          <InfoBox icon="calendar-outline" label="Last Updated" value={LAST_UPDATED} />
          <InfoBox icon="apps-outline" label="App Version" value={APP_VERSION} />
        </View>

        {/* 1. Data we collect */}
        <Section icon="server-outline" title="1. Information We Collect">
          <Paragraph>
            We collect the minimum information necessary to provide ChromaCode's services.
          </Paragraph>
          <ThemedText style={[styles.subHeading, { color: colors.text }]}>Account Information</ThemedText>
          <BulletItem text="Username and email address (required for registration)" />
          <BulletItem text="Password (stored as a one-way bcrypt hash — we never store plaintext passwords)" />
          <BulletItem text="Profile picture (optional, stored on our servers)" />
          <ThemedText style={[styles.subHeading, { color: colors.text }]}>Usage & Content</ThemedText>
          <BulletItem text="Messages you send in conversations and group chats" />
          <BulletItem text="Chroma codes you create (name, color, meaning)" />
          <BulletItem text="Media files you send (images, videos, audio, documents)" />
          <BulletItem text="Emoji reactions on messages" />
          <BulletItem text="Chat history (stored for conversation continuity)" />
          <ThemedText style={[styles.subHeading, { color: colors.text }]}>Technical Data</ThemedText>
          <BulletItem text="Device push notification token (for alerts when you receive messages)" />
          <BulletItem text="Session tokens (JWT, stored securely on your device)" />
          <BulletItem text="Basic request logs (IP address, timestamp, endpoint) for security monitoring" />
        </Section>

        {/* 2. How we use it */}
        <Section icon="construct-outline" title="2. How We Use Your Information">
          <BulletItem text="To authenticate you and maintain your session securely" />
          <BulletItem text="To deliver messages and media between users in real time" />
          <BulletItem text="To store and sync your Chroma code library across sessions" />
          <BulletItem text="To send push notifications for new messages and codes" />
          <BulletItem text="To enforce safety features (blocked users, rate limiting)" />
          <BulletItem text="To maintain server health and diagnose technical issues" />
          <Paragraph>
            We do not sell, rent, or trade your personal information to third parties for marketing purposes.
          </Paragraph>
        </Section>

        {/* 3. Security */}
        <Section icon="lock-closed-outline" title="3. Data Security">
          <Paragraph>
            ChromaCode takes security seriously and applies multiple layers of protection:
          </Paragraph>
          <ThemedText style={[styles.subHeading, { color: colors.text }]}>Transport Security</ThemedText>
          <BulletItem text="All communication between the app and our servers uses TLS (HTTPS/WSS) encryption" />
          <BulletItem text="This protects your data in transit from network eavesdroppers" />
          <ThemedText style={[styles.subHeading, { color: colors.text }]}>Server-Side Security</ThemedText>
          <BulletItem text="Passwords are hashed with bcrypt (never stored as plaintext)" />
          <BulletItem text="JWT tokens are signed and expire after a set period" />
          <BulletItem text="MongoDB data is encrypted at rest by the database provider" />
          <BulletItem text="Input sanitization prevents NoSQL injection attacks" />
          <BulletItem text="HTTP security headers (HSTS, XSS protection, CSP) via Helmet.js" />
          <BulletItem text="Rate limiting on authentication endpoints to prevent brute-force attacks" />
          <ThemedText style={[styles.subHeading, { color: colors.text }]}>Important Note on Encryption</ThemedText>
          <View style={[styles.warningBox, { backgroundColor: colors.icon + '10', borderColor: colors.icon + '25' }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.icon} style={{ marginRight: 8, marginTop: 2 }} />
            <ThemedText style={[styles.warningText, { color: colors.text }]}>
              ChromaCode uses{' '}
              <ThemedText style={{ fontWeight: 'bold' }}>transport-layer encryption (TLS)</ThemedText>
              , which means messages are encrypted between your device and our server. However, messages are stored
              on our servers and are accessible to our backend systems for delivery purposes. This is different from{' '}
              <ThemedText style={{ fontWeight: 'bold' }}>end-to-end encryption (E2E)</ThemedText>
              , where only the sender and recipient can read messages. We aim to implement true E2E encryption in a future update.
            </ThemedText>
          </View>
        </Section>

        {/* 4. Data Retention */}
        <Section icon="time-outline" title="4. Data Retention">
          <BulletItem text="Messages and media are retained for the lifetime of the conversation" />
          <BulletItem text="Deleted messages are removed from our database immediately" />
          <BulletItem text="If you delete your account, all associated data is removed within 30 days" />
          <BulletItem text="Server access logs are retained for up to 90 days for security purposes" />
        </Section>

        {/* 5. Third parties */}
        <Section icon="globe-outline" title="5. Third-Party Services">
          <Paragraph>
            ChromaCode relies on the following trusted third-party providers:
          </Paragraph>
          <BulletItem text="MongoDB Atlas — Database hosting with encryption at rest" />
          <BulletItem text="Expo / Expo Notifications — App delivery platform and push notification service" />
          <BulletItem text="Render / Hosting Provider — Server infrastructure (if applicable)" />
          <Paragraph>
            Each provider has their own privacy policy. We encourage you to review them for a complete picture of how your data is handled.
          </Paragraph>
        </Section>

        {/* 6. Your rights */}
        <Section icon="person-outline" title="6. Your Rights & Controls">
          <BulletItem text="Access: You can view all your profile information in the app at any time" />
          <BulletItem text="Correction: Update your username, profile picture, or password in Settings" />
          <BulletItem text="Deletion: Delete your account to remove all associated data" />
          <BulletItem text="Block: Block other users to prevent them from contacting you" />
          <BulletItem text="Message deletion: Delete individual messages you've sent" />
          <BulletItem text="Notifications: Disable push notifications at any time in Settings" />
        </Section>

        {/* 7. Children */}
        <Section icon="shield-outline" title="7. Children's Privacy">
          <Paragraph>
            ChromaCode is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with their information, please contact us immediately.
          </Paragraph>
        </Section>

        {/* 8. Changes */}
        <Section icon="refresh-outline" title="8. Changes to This Policy">
          <Paragraph>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the app or by updating the "Last Updated" date at the top of this document. Your continued use of ChromaCode after changes are posted constitutes your acceptance of the updated policy.
          </Paragraph>
        </Section>

        {/* 9. Contact */}
        <Section icon="mail-outline" title="9. Contact Us">
          <Paragraph>
            If you have any questions about this Privacy Policy, your data, or our security practices, please contact us through the app's feedback channels or reach out to our development team.
          </Paragraph>
        </Section>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.icon + '20' }]}>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            © 2026 ChromaCode. All rights reserved.
          </ThemedText>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            Last updated: {LAST_UPDATED} · Version {APP_VERSION}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 50 },
  hero: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  infoBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
    opacity: 0.9,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
