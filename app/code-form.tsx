import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCodes } from '@/hooks/useCodes';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyledButton } from '@/components/StyledButton'; // Import StyledButton
import { useSettings } from '@/hooks/useSettings'; // Import useSettings

export default function CodeFormScreen() {
  const { createCode, updateCode, codes, isLoading, error } = useCodes();
  const { toggleCodeVisibility, addCodeToVisibleCodes } = useSettings(); // Use useSettings
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditing = !!id; // Check if id exists to determine if in edit mode

  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [meaning, setMeaning] = useState('');

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (isEditing && codes.length > 0) {
      const codeToEdit = codes.find(c => c._id === id);
      if (codeToEdit) {
        setName(codeToEdit.name);
        setColor(codeToEdit.color);
        setMeaning(codeToEdit.meaning);
      }
    }
  }, [isEditing, id, codes]);

  const handleSubmit = async () => {
    if (!name || !color || !meaning) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    let success = false;
    if (isEditing && id) {
      success = await updateCode(id as string, name, color, meaning);
    } else {
      success = await createCode(name, color, meaning);
      if (success) {
        addCodeToVisibleCodes(name); // Add new code to visible codes permanently
      }
    }

    if (success) {
      Alert.alert('Success', `Code ${isEditing ? 'updated' : 'created'} successfully.`);
      router.back(); // Go back to the management screen
    } else {
      Alert.alert('Error', error || `Failed to ${isEditing ? 'update' : 'create'} code.`);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedText style={[styles.title, { color: colors.text }]}>
        {isEditing ? 'Edit Code' : 'Create New Code'}
      </ThemedText>
      <TextInput
        style={[styles.input, { borderColor: colors.icon, backgroundColor: colors.background, color: colors.text }]}
        placeholder="Code Name"
        placeholderTextColor={colors.icon}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, { borderColor: colors.icon, backgroundColor: colors.background, color: colors.text }]}
        placeholder="Color (e.g., #FFFFFF)"
        placeholderTextColor={colors.icon}
        value={color}
        onChangeText={setColor}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { borderColor: colors.icon, backgroundColor: colors.background, color: colors.text }]}
        placeholder="Meaning"
        placeholderTextColor={colors.icon}
        value={meaning}
        onChangeText={setMeaning}
        multiline
      />
      <StyledButton
        title={isEditing ? 'Update Code' : 'Create Code'}
        onPress={handleSubmit}
        isLoading={isLoading}
        style={styles.button}
      />
      <StyledButton title="Cancel" onPress={() => router.back()} style={[styles.button, { backgroundColor: colors.icon, marginTop: 10 }]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
  },
  button: {
    width: '100%',
  },
});
