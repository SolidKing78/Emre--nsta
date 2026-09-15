import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ListRow } from '@/components/common/Primitives';
import { FlaskIcon, ImageIcon, SearchIcon, ShareIcon } from '@/components/icons';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

/**
 * Options shared by the "+" sheet and the Create tab hub.
 * `onNavigate` lets a host sheet dismiss itself before navigating (it receives the target path).
 */
export function CreateOptions({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const go = (path: string) => {
    if (onNavigate) onNavigate(path);
    else router.push(path as never);
  };
  return (
    <View style={styles.root}>
      <ListRow title={t('create.simulatedPost')} subtitle={t('create.simulatedPostSub')} icon={<ImageIcon size={24} color={colors.text} />} onPress={() => go('/simulation/new-post')} />
      <ListRow title={t('create.scenario')} subtitle={t('create.scenarioSub')} icon={<FlaskIcon size={24} color={colors.simulation} />} onPress={() => go('/simulation?new=1')} />
      <ListRow title={t('create.shareCard')} subtitle={t('create.shareCardSub')} icon={<ShareIcon size={24} color={colors.text} />} onPress={() => go('/share')} />
      <ListRow title={t('create.publicLookup')} subtitle={t('create.publicLookupSub')} icon={<SearchIcon size={24} color={colors.text} />} onPress={() => go('/(auth)/public')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 8 },
});
