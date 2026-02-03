import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HelloWave } from '@/components/hello-wave';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <HelloWave />
        <ThemedText style={styles.title}>Welcome to ChromaCode!</ThemedText>
      </View>
      <View style={styles.content}>
        <ThemedText style={styles.subtitle}>Your secret language, simplified.</ThemedText>
        <ThemedText style={styles.paragraph}>
          ChromaCode helps you communicate with your close friends, family, or partner using a color-based language that you create together.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          Go to the <ThemedText style={{ fontWeight: 'bold' }}>Chroma</ThemedText> tab to send a code, check the <ThemedText style={{ fontWeight: 'bold' }}>History</ThemedText> tab to see your recent communications, and customize your codes in the settings.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  content: {
    width: '100%',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 10,
  },
});
