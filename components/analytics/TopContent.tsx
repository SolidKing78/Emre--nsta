import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { ListRow, SectionTitle } from '@/components/common/Primitives';
import { Skeleton } from '@/components/common/Skeleton';
import { Text } from '@/components/common/Text';
import { CheckIcon, ChevronDownIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT, type TranslationKey } from '@/i18n';
import { matchesFilter, sortPerformance, type ContentFilter, type ContentPerformance, type ContentSort } from '@/services/analytics/content';

import { ContentPerformanceCard } from './ContentPerformanceCard';

const FILTERS: { value: ContentFilter; key: TranslationKey }[] = [
  { value: 'all', key: 'analytics.filterAll' },
  { value: 'posts', key: 'analytics.filterPosts' },
  { value: 'reels', key: 'analytics.filterReels' },
  { value: 'carousels', key: 'analytics.filterCarousels' },
];

const SORTS: { value: ContentSort; key: TranslationKey }[] = [
  { value: 'views', key: 'analytics.sortViewed' },
  { value: 'reach', key: 'analytics.sortReached' },
  { value: 'engaged', key: 'analytics.sortEngaged' },
  { value: 'saves', key: 'analytics.sortSaved' },
  { value: 'shares', key: 'analytics.sortShared' },
  { value: 'comments', key: 'analytics.sortCommented' },
];

interface TopContentProps {
  items: ContentPerformance[];
  loading?: boolean;
  limit?: number;
  simulated?: boolean;
  title?: string;
}

export function TopContent({ items, loading, limit = 10, simulated, title }: TopContentProps) {
  const { colors } = useTheme();
  const t = useT();
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [sort, setSort] = useState<ContentSort>('views');
  const [sortOpen, setSortOpen] = useState(false);

  const visible = useMemo(() => sortPerformance(items.filter((i) => matchesFilter(i.media.type, filter)), sort).slice(0, limit), [items, filter, sort, limit]);
  const sortLabel = SORTS.find((s) => s.value === sort)?.key ?? 'analytics.sortViewed';

  return (
    <View>
      <SectionTitle
        title={title ?? t('analytics.topContent')}
        right={
          <Pressable onPress={() => setSortOpen(true)} style={styles.sortButton} accessibilityRole="button" accessibilityLabel={t('analytics.sortBy')}>
            <Text variant="captionStrong" color="secondary">
              {t(sortLabel)}
            </Text>
            <ChevronDownIcon size={14} color={colors.textSecondary} />
          </Pressable>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Pressable
              key={f.value}
              onPress={() => {
                triggerHaptic('selection');
                setFilter(f.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(f.key)}
              style={[styles.filter, { backgroundColor: active ? colors.text : colors.secondaryButton }]}
            >
              <Text variant="captionStrong" style={{ color: active ? colors.background : colors.text }}>
                {t(f.key)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.list}>
        {loading && items.length === 0 ? (
          <>
            <Skeleton height={136} radius={radius.lg} />
            <Skeleton height={136} radius={radius.lg} style={{ marginTop: spacing.md }} />
          </>
        ) : visible.length === 0 ? (
          <Text variant="body" color="secondary" align="center" style={{ paddingVertical: spacing.xl }}>
            {t('analytics.noContent')}
          </Text>
        ) : (
          visible.map((item, i) => (
            <View key={item.media.id} style={{ marginBottom: spacing.md }}>
              <ContentPerformanceCard item={item} rank={i + 1} simulated={simulated} />
            </View>
          ))
        )}
      </View>
      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t('analytics.sortBy')}>
        {SORTS.map((s) => (
          <ListRow
            key={s.value}
            title={t(s.key)}
            chevron={false}
            right={s.value === sort ? <CheckIcon size={18} color={colors.primary} /> : null}
            onPress={() => {
              setSort(s.value);
              setSortOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  filter: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill },
  list: { paddingHorizontal: spacing.lg },
});
