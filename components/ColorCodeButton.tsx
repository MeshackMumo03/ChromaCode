import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  View,
  ViewStyle,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Code } from '@/constants/codes';
import { Ionicons } from '@expo/vector-icons';

type ColorCodeButtonProps = {
  code: Code;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

/**
 * ChromaCodeCard — rich card component for displaying a color code.
 * Shows: colored left accent bar, code name, truncated meaning, and a send icon.
 * Replaces the old simple button so pre-existing codes look identical to
 * codes received in chat messages.
 */
export function ColorCodeButton({ code, onPress, style }: ColorCodeButtonProps) {
  // Derive a slightly transparent version of the code color for the gradient overlay
  const colorHex = code.color || '#007AFF';

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Colored left accent sidebar — same as in-chat rich message card */}
      <View style={[styles.accentBar, { backgroundColor: colorHex }]} />

      {/* Subtle color wash behind the card content */}
      <View style={[styles.colorWash, { backgroundColor: colorHex + '1A' }]} />

      <View style={styles.content}>
        {/* Color swatch circle + name row */}
        <View style={styles.nameRow}>
          <View style={[styles.colorDot, { backgroundColor: colorHex }]} />
          <ThemedText style={styles.codeName} numberOfLines={1}>
            {code.name}
          </ThemedText>
        </View>

        {/* Meaning text */}
        <ThemedText style={styles.codeMeaning} numberOfLines={2}>
          {code.meaning}
        </ThemedText>

        {/* Footer row: tap hint */}
        <View style={styles.footer}>
          <ThemedText style={[styles.tapHint, { color: colorHex }]}>
            Tap to send
          </ThemedText>
          <Ionicons name="send-outline" size={13} color={colorHex} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    margin: 5,
    flex: 1,
    minWidth: '45%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    // Shadow for depth
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    minHeight: 100,
  },
  accentBar: {
    width: 6,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  colorWash: {
    ...StyleSheet.absoluteFillObject,
    left: 6,
    borderRadius: 16,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 7,
  },
  codeName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.3,
  },
  codeMeaning: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.75,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
