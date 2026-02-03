import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, FlatList, View, Switch } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/hooks/useSettings';
import { CODES } from '@/constants/codes';

export default function ModalScreen() {
  const { visibleCodes, toggleCodeVisibility } = useSettings();

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Customize Codes</ThemedText>
      <FlatList
        data={CODES}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
            <ThemedText style={styles.itemName}>{item.name}</ThemedText>
            <Switch
              value={visibleCodes.includes(item.name)}
              onValueChange={() => toggleCodeVisibility(item.name)}
            />
          </View>
        )}
      />

      {/* Use a light status bar on iOS to account for the black background. On Android, build-time configuration is required. */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#333',
    borderRadius: 10,
  },
  itemName: {
    fontSize: 18,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 15,
  },
});
