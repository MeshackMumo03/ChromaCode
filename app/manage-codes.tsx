import React from 'react';
import { StyleSheet, FlatList, View, Button, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCodes } from '@/hooks/useCodes';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';
import { Code } from '@/constants/codes';

export default function CodeManagementScreen() {
  const { codes, isLoading, error, deleteCode } = useCodes();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Code',
      'Are you sure you want to delete this code?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            const success = await deleteCode(id);
            if (success) {
              Alert.alert('Success', 'Code deleted successfully.');
            } else {
              Alert.alert('Error', error || 'Failed to delete code.');
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const renderItem = ({ item }: { item: Code }) => (
    <View style={[styles.codeItem, { backgroundColor: colors.background, borderColor: colors.icon }]}>
      <View style={[styles.colorPreview, { backgroundColor: item.color }]} />
      <View style={styles.codeDetails}>
        <ThemedText style={[styles.codeName, { color: colors.text }]}>{item.name}</ThemedText>
        <ThemedText style={[styles.codeMeaning, { color: colors.icon }]}>{item.meaning}</ThemedText>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/code-form', params: { id: item._id } })}>
          <ThemedText style={[styles.actionButton, { color: colors.tint }]}>Edit</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item._id)}>
          <ThemedText style={[styles.actionButton, { color: colors.tint }]}>Delete</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={{ color: colors.text, marginTop: 10 }}>Loading codes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedText style={[styles.title, { color: colors.text }]}>Manage Codes</ThemedText>
      <Button title="Add New Code" onPress={() => router.push('/code-form')} color={colors.tint} />
      {codes.length > 0 ? (
        <FlatList
          data={codes}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <ThemedText style={[styles.emptyText, { color: colors.icon }]}>No codes found. Add a new one!</ThemedText>
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
  listContainer: {
    paddingVertical: 10,
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 15,
  },
  codeDetails: {
    flex: 1,
  },
  codeName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  codeMeaning: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 15,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});
