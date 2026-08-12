import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, View, TouchableOpacity, Modal, ScrollView, FlatList } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCodes } from '@/hooks/useCodes';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyledButton } from '@/components/StyledButton';
import { useSettings } from '@/hooks/useSettings';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '@/hooks/useToast';

// Curated color palette — 30 colors across warm, cool, neutral and vibrant hues
const COLOR_PALETTE = [
  // Reds / Pinks
  '#FF3B30', '#FF6B6B', '#FF2D55', '#FF69B4', '#E91E8C',
  // Oranges / Yellows
  '#FF9500', '#FF6D00', '#FFCC00', '#FFD60A', '#F4D03F',
  // Greens
  '#34C759', '#30D158', '#00C853', '#4CAF50', '#1B5E20',
  // Blues
  '#007AFF', '#5AC8FA', '#0A84FF', '#1565C0', '#0D47A1',
  // Purples / Indigo
  '#5856D6', '#AF52DE', '#7B2FBE', '#6A1B9A', '#4A148C',
  // Neutrals / Browns
  '#8D6E63', '#795548', '#9E9E9E', '#607D8B', '#263238',
];

function isValidHex(hex: string) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

export default function CodeFormScreen() {
  const { createCode, updateCode, codes, isLoading, error } = useCodes();
  const { toggleCodeVisibility, addCodeToVisibleCodes } = useSettings();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [color, setColor] = useState('#007AFF');
  const [hexInput, setHexInput] = useState('#007AFF');
  const [meaning, setMeaning] = useState('');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showToast } = useToast();

  useEffect(() => {
    if (isEditing && codes.length > 0) {
      const codeToEdit = codes.find(c => c._id === id);
      if (codeToEdit) {
        setName(codeToEdit.name);
        setColor(codeToEdit.color);
        setHexInput(codeToEdit.color);
        setMeaning(codeToEdit.meaning);
      }
    }
  }, [isEditing, id, codes]);

  const handleSelectPaletteColor = (c: string) => {
    setColor(c);
    setHexInput(c);
  };

  const handleHexInputChange = (text: string) => {
    setHexInput(text);
    const formatted = text.startsWith('#') ? text : `#${text}`;
    if (isValidHex(formatted)) {
      setColor(formatted);
    }
  };

  const handleHexInputBlur = () => {
    const formatted = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (isValidHex(formatted)) {
      setColor(formatted);
      setHexInput(formatted);
    } else {
      setHexInput(color); // reset to last valid
    }
  };

  const handleSubmit = async () => {
    if (!name || !color || !meaning) {
      showToast('Please fill in all fields.', 'error');
      return;
    }
    if (!isValidHex(color)) {
      showToast('Please select or enter a valid hex color (e.g., #FF3B30).', 'error');
      return;
    }

    let success = false;
    if (isEditing && id) {
      success = await updateCode(id as string, name, color, meaning);
    } else {
      success = await createCode(name, color, meaning);
      if (success) {
        addCodeToVisibleCodes(name);
      }
    }

    if (success) {
      showToast(`Code ${isEditing ? 'updated' : 'created'} successfully.`, 'success');
      router.back();
    } else {
      showToast(error || `Failed to ${isEditing ? 'update' : 'create'} code.`, 'error');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Code' : 'New Code',
          headerShown: true,
          headerTintColor: colors.tint,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Code Name</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.icon + '60', backgroundColor: colors.icon + '10', color: colors.text }]}
          placeholder="e.g. Red Alert"
          placeholderTextColor={colors.icon}
          value={name}
          onChangeText={setName}
        />

        {/* ── Color Picker ── */}
        <ThemedText style={[styles.label, { color: colors.text }]}>Color</ThemedText>
        <TouchableOpacity
          style={[styles.colorSwatchRow, { borderColor: colors.icon + '40', backgroundColor: colors.icon + '10' }]}
          onPress={() => setColorPickerVisible(true)}
          activeOpacity={0.85}
        >
          <View style={[styles.colorSwatchPreview, { backgroundColor: color }]} />
          <ThemedText style={[styles.colorSwatchLabel, { color: colors.text }]}>{color.toUpperCase()}</ThemedText>
          <Ionicons name="chevron-forward" size={18} color={colors.icon} />
        </TouchableOpacity>

        <ThemedText style={[styles.label, { color: colors.text }]}>Meaning</ThemedText>
        <TextInput
          style={[styles.input, styles.meaningInput, { borderColor: colors.icon + '60', backgroundColor: colors.icon + '10', color: colors.text }]}
          placeholder="What does this code mean?"
          placeholderTextColor={colors.icon}
          value={meaning}
          onChangeText={setMeaning}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <StyledButton
          title={isEditing ? 'Update Code' : 'Create Code'}
          onPress={handleSubmit}
          isLoading={isLoading}
          style={styles.button}
        />
        <StyledButton
          title="Cancel"
          onPress={() => router.back()}
          style={{ width: '100%', backgroundColor: colors.icon + '40', marginTop: 10 }}
        />
      </ScrollView>

      {/* ── Color Picker Modal ── */}
      <Modal
        visible={colorPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setColorPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <ThemedView style={[styles.pickerSheet, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.pickerHeader}>
              <ThemedText style={styles.pickerTitle}>Pick a Color</ThemedText>
              <TouchableOpacity onPress={() => setColorPickerVisible(false)}>
                <Ionicons name="close-circle" size={28} color={colors.icon} />
              </TouchableOpacity>
            </View>

            {/* Live preview */}
            <View style={[styles.pickerPreviewBar, { backgroundColor: color }]}>
              <ThemedText style={styles.pickerPreviewText}>{color.toUpperCase()}</ThemedText>
            </View>

            {/* Palette grid */}
            <ThemedText style={[styles.pickerSectionLabel, { color: colors.icon }]}>PALETTE</ThemedText>
            <View style={styles.paletteGrid}>
              {COLOR_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.paletteCell,
                    { backgroundColor: c },
                    color === c && styles.paletteCellSelected,
                  ]}
                  onPress={() => handleSelectPaletteColor(c)}
                  activeOpacity={0.75}
                >
                  {color === c && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom hex input */}
            <ThemedText style={[styles.pickerSectionLabel, { color: colors.icon }]}>CUSTOM HEX</ThemedText>
            <View style={styles.hexRow}>
              <View style={[styles.hexPreviewDot, { backgroundColor: isValidHex(hexInput.startsWith('#') ? hexInput : `#${hexInput}`) ? (hexInput.startsWith('#') ? hexInput : `#${hexInput}`) : '#ccc' }]} />
              <TextInput
                style={[styles.hexInput, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.icon + '10' }]}
                value={hexInput}
                onChangeText={handleHexInputChange}
                onBlur={handleHexInputBlur}
                placeholder="#RRGGBB"
                placeholderTextColor={colors.icon}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>

            <StyledButton
              title="Done"
              onPress={() => setColorPickerVisible(false)}
              style={{ marginTop: 20 }}
            />
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    opacity: 0.7,
  },
  input: {
    width: '100%',
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  meaningInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    gap: 12,
  },
  colorSwatchPreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  colorSwatchLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  button: {
    width: '100%',
    marginTop: 24,
  },
  // Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  pickerPreviewBar: {
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  pickerPreviewText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  paletteCell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  paletteCellSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hexPreviewDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  hexInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: 'monospace',
  },
});
