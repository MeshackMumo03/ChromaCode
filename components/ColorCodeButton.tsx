import React from 'react';
import { TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Code } from '@/constants/codes';

type ColorCodeButtonProps = {
  code: Code;
  onPress: (event: GestureResponderEvent) => void;
};

export function ColorCodeButton({ code, onPress }: ColorCodeButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: code.color }]}
      onPress={onPress}
    >
      <ThemedText style={styles.text}>{code.name}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
    flex: 1,
    minWidth: '45%',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});
