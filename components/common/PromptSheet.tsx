import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface PromptSheetProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

/** Small text prompt (scenario names etc.) as a bottom sheet. */
export function PromptSheet({ visible, title, placeholder, initialValue = '', confirmLabel, onConfirm, onClose }: PromptSheetProps) {
  const { colors } = useTheme();
  const t = useT();
  const [value, setValue] = useState(initialValue);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setValue(initialValue);
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => value.trim() && onConfirm(value.trim())}
          style={[styles.input, { borderColor: colors.borderStrong, color: colors.text, backgroundColor: colors.surfaceElevated }]}
          accessibilityLabel={title}
        />
        <Button title={confirmLabel ?? t('common.save')} onPress={() => value.trim() && onConfirm(value.trim())} disabled={!value.trim()} style={{ marginTop: spacing.lg }} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, fontSize: 16 },
});
