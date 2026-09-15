import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ChevronLeftIcon } from '@/components/icons';
import { spacing, touch } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

import { IconButton } from './IconButton';
import { Text } from './Text';

interface AppHeaderProps {
  title?: string;
  /** Custom node instead of the title text (e.g. the wordmark). */
  titleNode?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Centered title (Instagram detail screens) vs. left aligned (feed/profile). */
  centered?: boolean;
  bordered?: boolean;
}

export function AppHeader({ title, titleNode, showBack, onBack, left, right, centered = true, bordered = false }: AppHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const t = useT();
  const back = showBack ? (
    <IconButton
      accessibilityLabel={t('common.back')}
      onPress={() => {
        if (onBack) onBack();
        else if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/home');
      }}
    >
      <ChevronLeftIcon color={colors.text} size={26} />
    </IconButton>
  ) : null;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, borderBottomColor: colors.border, borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0 },
      ]}
    >
      <View style={styles.side}>
        {back}
        {left}
        {!centered && (titleNode ?? (title ? <Text variant="heading" weight="700" numberOfLines={1} style={styles.leftTitle}>{title}</Text> : null))}
      </View>
      {centered ? (
        <View style={styles.center} pointerEvents="box-none">
          {titleNode ?? (
            <Text variant="title" numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
      ) : null}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: touch.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  side: { flexDirection: 'row', alignItems: 'center', minWidth: 44, flex: 1 },
  right: { justifyContent: 'flex-end' },
  center: { position: 'absolute', left: 60, right: 60, alignItems: 'center', justifyContent: 'center', top: 0, bottom: 0 },
  leftTitle: { marginLeft: spacing.md },
});
