import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { ListRow } from '@/components/common/Primitives';
import { EditIcon, ExternalIcon, FlaskIcon, InsightsIcon } from '@/components/icons';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import type { AppMedia } from '@/types/app';

interface PostOptionsSheetProps {
  media: AppMedia | null;
  onClose: () => void;
}

/** "•••" menu on a post: insights, simulate, open on Instagram. */
export function PostOptionsSheet({ media, onClose }: PostOptionsSheetProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const go = (path: string) => {
    onClose();
    setTimeout(() => router.push(path), 180);
  };
  return (
    <BottomSheet visible={Boolean(media)} onClose={onClose}>
      {media ? (
        <View style={styles.body}>
          <ListRow title={t('media.viewInsights')} icon={<InsightsIcon size={22} color={colors.text} />} onPress={() => go(`/media/${media.id}`)} chevron={false} />
          <ListRow title={t('media.simulate')} icon={<FlaskIcon size={22} color={colors.simulation} />} onPress={() => go(`/simulation/media/${media.id}`)} chevron={false} />
          {media.isSimulated ? (
            <ListRow title={t('sim.editProfile')} icon={<EditIcon size={22} color={colors.text} />} onPress={() => go('/simulation')} chevron={false} />
          ) : null}
          {media.permalink ? (
            <ListRow
              title={t('media.openOnInstagram')}
              icon={<ExternalIcon size={22} color={colors.text} />}
              onPress={() => {
                onClose();
                void Linking.openURL(media.permalink);
              }}
              chevron={false}
            />
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 8 },
});
