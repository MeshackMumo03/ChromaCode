
import React from 'react';
import { StyleSheet, FlatList, Alert, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { CODES, Code } from '@/constants/codes';
import { ColorCodeButton } from '@/components/ColorCodeButton';
import { useHistory } from '@/hooks/useHistory';
import { useSettings } from '@/hooks/useSettings';
import { Link } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ChromaScreen() {
  const { addHistoryItem } = useHistory();
  const { visibleCodes } = useSettings();

  const handlePress = (code: Code) => {
    addHistoryItem(code);
    Alert.alert(`"${code.name}" sent!`, code.meaning);
  };

  const filteredCodes = CODES.filter(code => visibleCodes.includes(code.name));

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Chroma Codes</ThemedText>
        <Link href="/modal" style={styles.customizeButton}>
          <IconSymbol size={28} name="gearshape.fill" />
        </Link>
      </View>
      <FlatList
        data={filteredCodes}
        renderItem={({ item }) => (
          <ColorCodeButton code={item} onPress={() => handlePress(item)} />
        )}
        keyExtractor={(item) => item.name}
        numColumns={2}
        contentContainerStyle={styles.list}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  list: {
    justifyContent: 'center',
  },
  customizeButton: {
    marginRight: 15,
  },
});
