import React from 'react';
import { StyleSheet, FlatList, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useHistory, HistoryItem } from '@/hooks/useHistory';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function HistoryScreen() {
  const { history, isLoading, error, fetchHistory } = useHistory();
  const [refreshing, setRefreshing] = React.useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <View style={[styles.itemContainer, { backgroundColor: colors.background, borderBottomColor: colors.icon }]}>
      <View style={[styles.colorIndicator, { backgroundColor: item.code.color }]} />
      <View style={styles.itemTextContainer}>
        <ThemedText style={[styles.itemName, { color: colors.text }]}>{item.code.name}</ThemedText>
        {item.recipient && (
          <ThemedText style={[styles.itemRecipient, { color: colors.icon }]}>Sent to: {item.recipient.username}</ThemedText>
        )}
        <ThemedText style={[styles.itemMeaning, { color: colors.icon }]}>{item.code.meaning}</ThemedText>
        <ThemedText style={[styles.itemTimestamp, { color: colors.icon }]}>
          {new Date(item.timestamp).toLocaleString()}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText style={[styles.title, { color: colors.text }]}>History</ThemedText>
        
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
            <ThemedText style={styles.errorHint}>
              Make sure your backend server is running on port 5000
            </ThemedText>
          </View>
        )}

        {isLoading && history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.tint}/>
            <ThemedText style={[styles.loadingText, { color: colors.text }]}>Loading history...</ThemedText>
          </View>
        ) : history.length > 0 ? (
          <FlatList
            data={history}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.tint]} tintColor={colors.tint}/>
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <ThemedText style={{ color: colors.text }}>No codes sent yet.</ThemedText>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    paddingTop: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 15,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemMeaning: {
    fontSize: 14,
  },
  itemRecipient: {
    fontSize: 12,
    marginTop: 2,
  },
  itemTimestamp: {
    fontSize: 12,
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  errorContainer: {
    backgroundColor: '#ff6b6b',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorHint: {
    color: '#fff',
    fontSize: 12,
  },
});