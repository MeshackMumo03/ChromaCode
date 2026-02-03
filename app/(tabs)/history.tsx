import React from 'react';
import { StyleSheet, FlatList, View, ActivityIndicator, RefreshControl } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useHistory, HistoryItem } from '@/hooks/useHistory';

export default function HistoryScreen() {
  const { history, isLoading, error, fetchHistory } = useHistory();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <View style={styles.itemContainer}>
      <View style={[styles.colorIndicator, { backgroundColor: item.code.color }]} />
      <View style={styles.itemTextContainer}>
        <ThemedText style={styles.itemName}>{item.code.name}</ThemedText>
        <ThemedText style={styles.itemMeaning}>{item.code.meaning}</ThemedText>
        <ThemedText style={styles.itemTimestamp}>
          {new Date(item.timestamp).toLocaleString()}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>History</ThemedText>
      
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
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading history...</ThemedText>
        </View>
      ) : history.length > 0 ? (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <ThemedText>No codes sent yet.</ThemedText>
        </View>
      )}
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
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#333',
    borderRadius: 10,
    alignItems: 'center',
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
    color: '#ccc',
  },
  itemTimestamp: {
    fontSize: 12,
    color: '#999',
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