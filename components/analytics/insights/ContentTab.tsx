import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { ListRow } from '@/components/common/Primitives';
import { Text } from '@/components/common/Text';
import { CarouselIcon, CheckIcon, CommentIcon, HeartIcon, ReelBadgeIcon, RefreshIcon, ShareIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import type { useInsightsData } from '@/features/analytics/useInsightsData';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { ContentPerformance } from '@/services/analytics/content';
import { formatRelativeShort } from '@/utils/date';
import { formatCompact } from '@/utils/format';

import { ChipRow, DropdownButton } from './primitives';

type Filter = 'all' | 'posts' | 'reels' | 'carousels';
type Sort = 'newest' | 'views' | 'viewers';

interface ContentTabProps {
  data: ReturnType<typeof useInsightsData>;
  rangeLabel: string;
  onOpenRange: () => void;
}

function matches(item: ContentPerformance, filter: Filter): boolean {
  const type = item.media.type;
  if (filter === 'all') return true;
  if (filter === 'reels') return type === 'REEL' || type === 'VIDEO';
  if (filter === 'carousels') return type === 'CAROUSEL_ALBUM';
  return type === 'IMAGE' || type === 'CAROUSEL_ALBUM';
}

/** Instagram "İçerik" tab: every post with likes / comments / reposts / shares and the view count. */
export function ContentTab({ data, rangeLabel, onOpenRange }: ContentTabProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [filterOpen, setFilterOpen] = useState(false);

  const items = useMemo(() => {
    const list = data.performance.items.filter((i) => matches(i, filter));
    if (sort === 'views') return [...list].sort((a, b) => b.views - a.views);
    if (sort === 'viewers') return [...list].sort((a, b) => b.reach - a.reach);
    return [...list].sort((a, b) => b.media.timestamp.localeCompare(a.media.timestamp));
  }, [data.performance.items, filter, sort]);

  const filterLabel = filter === 'all' ? t('insights.allContent') : filter === 'posts' ? t('insights.contentPosts') : filter === 'reels' ? t('insights.contentReels') : t('insights.contentCarousels');

  return (
    <View>
      <View style={styles.headerRow}>
        <DropdownButton label={filterLabel} onPress={() => setFilterOpen(true)} large />
        <DropdownButton label={rangeLabel} onPress={onOpenRange} />
      </View>
      <ChipRow<Sort>
        value={sort}
        onChange={setSort}
        options={[
          { value: 'newest', label: t('insights.sortNewest') },
          { value: 'views', label: t('insights.sortViews') },
          { value: 'viewers', label: t('insights.sortViewers') },
        ]}
      />
      {items.length === 0 ? (
        <Text variant="body" color="secondary" style={{ padding: spacing.lg }}>
          {t('insights.noData')}
        </Text>
      ) : null}
      {items.map((item) => {
        const { media } = item;
        const isReel = media.type === 'REEL' || media.type === 'VIDEO';
        const primary = sort === 'viewers' ? item.reach : item.views;
        const caption = media.caption.split('\n')[0]?.trim() ?? '';
        return (
          <Pressable key={media.id} onPress={() => router.push(`/media/${media.id}`)} style={styles.row} accessibilityRole="button" accessibilityLabel={caption || t(`type.${media.type}`)}>
            <View style={styles.thumbWrap}>
              <Image source={{ uri: media.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} />
              <View style={styles.thumbBadge}>{isReel ? <ReelBadgeIcon size={14} /> : media.type === 'CAROUSEL_ALBUM' ? <CarouselIcon size={14} /> : null}</View>
            </View>
            <View style={styles.middle}>
              <Text variant="body" color={caption ? 'primary' : 'secondary'} numberOfLines={1}>
                {caption ? `${caption} ` : ''}
                <Text variant="body" color="secondary">
                  {formatRelativeShort(media.timestamp, language)}
                </Text>
              </Text>
              <View style={styles.icons}>
                <View style={styles.iconStat}>
                  <HeartIcon size={18} color={colors.textSecondary} />
                  <Text variant="body" color="secondary" style={styles.iconValue}>
                    {formatCompact(item.likes, language)}
                  </Text>
                </View>
                <View style={styles.iconStat}>
                  <CommentIcon size={18} color={colors.textSecondary} strokeWidth={1.8} />
                  <Text variant="body" color="secondary" style={styles.iconValue}>
                    {formatCompact(item.comments, language)}
                  </Text>
                </View>
                <View style={styles.iconStat}>
                  <RefreshIcon size={18} color={colors.textSecondary} strokeWidth={1.8} />
                  <Text variant="body" color="secondary" style={styles.iconValue}>
                    {formatCompact(Math.round(item.shares * 0.35), language)}
                  </Text>
                </View>
                <View style={styles.iconStat}>
                  <ShareIcon size={18} color={colors.textSecondary} strokeWidth={1.8} />
                  <Text variant="body" color="secondary" style={styles.iconValue}>
                    {formatCompact(item.shares, language)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.right}>
              <Text variant="display" weight="600" style={{ fontSize: 26 }}>
                {formatCompact(primary, language)}
              </Text>
              <Text variant="body" color="secondary">
                {sort === 'viewers' ? t('insights.sortViewers') : t('insights.sortViews')}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <View style={{ height: spacing.xxxl }} />

      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title={t('analytics.filter')}>
        {(
          [
            ['all', t('insights.allContent')],
            ['posts', t('insights.contentPosts')],
            ['reels', t('insights.contentReels')],
            ['carousels', t('insights.contentCarousels')],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <ListRow
            key={value}
            title={label}
            chevron={false}
            right={value === filter ? <CheckIcon size={18} color={colors.primary} /> : null}
            onPress={() => {
              setFilter(value);
              setFilterOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  thumbWrap: { width: 78, height: 104, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#222' },
  thumbBadge: { position: 'absolute', top: 6, right: 6 },
  middle: { flex: 1, marginLeft: spacing.lg },
  icons: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.lg },
  iconStat: { flexDirection: 'row', alignItems: 'center' },
  iconValue: { marginLeft: 4 },
  right: { alignItems: 'flex-end', marginLeft: spacing.md },
});
