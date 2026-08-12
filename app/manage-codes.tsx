import React from 'react';
import { StyleSheet, FlatList, View, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCodes } from '@/hooks/useCodes';
import { useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Code } from '@/constants/codes';
import { useToast } from '@/hooks/useToast';

export default function CodeManagementScreen() {
  const { codes, isLoading, error, deleteCode } = useCodes();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showToast } = useToast();

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
              showToast('Code deleted successfully.', 'success');
            } else {
              showToast(error || 'Failed to delete code.', 'error');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Manage Codes', headerShown: true, headerTintColor: colors.tint, headerStyle: { backgroundColor: colors.background }, headerTitleStyle: { color: colors.text } }} />
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.tint, marginTop: 10 }]} onPress={() => router.push('/code-form')}>
        <ThemedText style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>+ Add New Code</ThemedText>
      </TouchableOpacity>
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
  button: {
    padding: 15,
    borderRadius: 8,
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
