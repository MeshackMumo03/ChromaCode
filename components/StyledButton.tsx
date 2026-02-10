import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

interface StyledButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function StyledButton({ title, onPress, disabled, isLoading, style, textStyle }: StyledButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const buttonStyle = [
    styles.button,
    { backgroundColor: colors.tint },
    (disabled || isLoading) && styles.disabled,
    style,
  ];

  const textColor = colorScheme === 'light' ? '#fff' : Colors.dark.background;

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || isLoading} style={buttonStyle}>
      {isLoading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.7,
  },
});
