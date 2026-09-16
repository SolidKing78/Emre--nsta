import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { PercentField } from '@/components/simulation/PercentField';
import { spacing } from '@/constants/theme';
import { useSimulationActions } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useT } from '@/i18n';

/** What the screen hands over when a long-press opens the editor. */
export interface StatEdit {
  /** Dotted override key, e.g. `factor.likes` or `source.reels`. */
  key: string;
  title: string;
  subtitle?: string;
  /** The value on screen right now. */
  value: number;
  max?: number;
  /** True while the value on screen was already set by hand. */
  isCustom: boolean;
}

interface StatPercentSheetProps {
  edit: StatEdit | null;
  /** The post the value belongs to; leave it out to edit an account-level bar. */
  mediaId?: string;
  onClose: () => void;
}

/**
 * Edits one percentage on the post insights screen — a factor rate, a view source, an
 * age or country bar, the watch curve's tail. Every value on that screen goes through the
 * same sheet, so a long-press always does the same thing.
 */
export function StatPercentSheet({ edit, mediaId, onClose }: StatPercentSheetProps) {
  const t = useT();
  const actions = useSimulationActions();
  const [draft, setDraft] = useState(edit?.value ?? 0);
  const [lastKey, setLastKey] = useState(edit?.key);
  if (edit && edit.key !== lastKey) {
    setLastKey(edit.key);
    setDraft(edit.value);
  }

  const write = (value: number | undefined) => {
    if (!edit) return;
    if (mediaId) actions.setMediaStat(mediaId, edit.key, value);
    else actions.setAccountStat(edit.key, value);
  };

  const apply = () => {
    write(draft);
    triggerHaptic('success');
    onClose();
  };

  const reset = () => {
    write(undefined);
    triggerHaptic('warning');
    onClose();
  };

  return (
    <BottomSheet visible={edit !== null} onClose={onClose} title={edit?.title}>
      <View style={styles.body}>
        {edit ? (
          <>
            {edit.subtitle ? (
              <Text variant="caption" color="secondary">
                {edit.subtitle}
              </Text>
            ) : null}
            <PercentField
              label={edit.title}
              value={draft}
              onChange={setDraft}
              max={edit.max ?? 100}
              fine={(edit.max ?? 100) > 20 && draft < 5}
              tone="simulation"
            />
            <Text variant="small" color="tertiary" style={{ marginTop: spacing.sm }}>
              {mediaId ? t('postStats.editHint') : t('postStats.editHintAccount')}
            </Text>
            <Button title={t('common.apply')} size="lg" onPress={apply} style={{ marginTop: spacing.lg }} />
            {edit.isCustom ? (
              <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel={t('postStats.resetValue')} style={styles.clearLink}>
                <Text variant="bodyStrong" color="secondary" align="center">
                  {t('postStats.resetValue')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  clearLink: { paddingVertical: spacing.md },
});
