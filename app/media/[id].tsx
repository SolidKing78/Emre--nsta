import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricRow } from '@/components/analytics/MetricRow';
import { RetentionChart } from '@/components/analytics/RetentionChart';
import { AppHeader } from '@/components/common/AppHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Card, Chip, Divider, SectionTitle } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { PostSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { FlaskIcon, InfoIcon } from '@/components/icons';
import { SimulationBadge } from '@/components/simulation/SimulationBadge';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing } from '@/constants/theme';
import { useComments } from '@/features/instagram/hooks';
import { useMediaDetail } from '@/features/instagram/useMediaDetail';
import { useDisplayMetrics, useSimulationEnabled, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { upperCase, useLanguage, useT } from '@/i18n';
import { engagementFromMetrics } from '@/services/analytics/engagement';
import { useSettingsStore } from '@/store/settingsStore';
import type { AppMedia, MetricKey } from '@/types/app';
import { formatLongDate, formatRelativeShort } from '@/utils/date';
import { formatPercent } from '@/utils/format';

const OVERVIEW: MetricKey[] = ['views', 'reach', 'interactions'];
const ENGAGEMENT: MetricKey[] = ['likes', 'comments', 'shares', 'saves'];
const PROFILE: MetricKey[] = ['follows_from_post'];
const REEL: MetricKey[] = ['avg_watch_time', 'replays'];

export default function MediaDetailScreen() {
  const { id, insights: insightsParam } = useLocalSearchParams<{ id: string; insights?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const simulation = useSimulationEnabled();
  const indicators = useSimulationIndicators();
  const editor = useMetricEditor();
  const formula = useSettingsStore((s) => s.engagementFormula);
  const scrollRef = useRef<ScrollView>(null);
  const [insightsY, setInsightsY] = useState(0);
  const [options, setOptions] = useState<AppMedia | null>(null);

  const detail = useMediaDetail(id);
  const { data: comments } = useComments(detail.isSimulatedPost ? undefined : id);
  const metrics = useDisplayMetrics(detail.scope, detail.realInsight?.metrics);
  const byKey = (key: MetricKey) => metrics.find((m) => m.key === key);
  const available = useMemo(() => new Set(metrics.map((m) => m.key)), [metrics]);
  const er = detail.realInsight ? engagementFromMetrics(detail.insight?.metrics ?? [], detail.account?.followersCount ?? 0, formula) : null;

  useEffect(() => {
    if (insightsParam && insightsY > 0) {
      const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: insightsY - 8, animated: true }), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [insightsParam, insightsY]);

  if (detail.error && !detail.media) {
    return (
      <Screen>
        <AppHeader title={t('media.title')} showBack />
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      </Screen>
    );
  }

  const media = detail.media;
  const missing = [...OVERVIEW, ...ENGAGEMENT].filter((k) => !available.has(k));

  const section = (keys: MetricKey[], title: string, emphasized = false) => {
    const rows = keys.map((k) => byKey(k)).filter((m): m is NonNullable<typeof m> => Boolean(m));
    if (rows.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text variant="captionStrong" color="secondary" style={styles.sectionLabel}>
          {upperCase(title, language)}
        </Text>
        {rows.map((m, i) => (
          <MetricRow key={m.key} metric={m} scope={detail.scope} last={i === rows.length - 1} emphasized={emphasized} subtitle={undefined} />
        ))}
      </View>
    );
  };

  return (
    <Screen>
      <AppHeader
        title={media?.type === 'REEL' ? t('feed.reel') : t('media.title')}
        showBack
        right={indicators ? <SimulationBadge style={{ marginRight: spacing.sm }} /> : undefined}
      />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {!media ? (
          <PostSkeleton />
        ) : (
          <>
            <PostCard
              media={media}
              avatarUrl={detail.account?.profilePictureUrl}
              verified={detail.account?.isVerified}
              expanded
              onPressMore={setOptions}
              onPressInsights={() => scrollRef.current?.scrollTo({ y: insightsY - 8, animated: true })}
              shareCount={available.has('shares') ? byKey('shares')?.value : undefined}
            />
            <Pressable
              onPress={() => scrollRef.current?.scrollTo({ y: insightsY - 8, animated: true })}
              accessibilityRole="button"
              accessibilityLabel={t('media.viewInsights')}
              style={[styles.insightsButton, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
            >
              <Text variant="feedStrong">{t('media.viewInsights')}</Text>
              <Text variant="small" color="secondary">
                {t('common.onlyVisibleToYou')}
              </Text>
            </Pressable>

            {/* Insights */}
            <View onLayout={(e) => setInsightsY(e.nativeEvent.layout.y)} style={styles.insights}>
              <SectionTitle
                title={t('media.insightsTitle')}
                style={{ paddingHorizontal: 0, paddingTop: spacing.sm }}
                right={
                  indicators ? (
                    <Pressable onPress={() => router.push(`/simulation/media/${media.id}`)} accessibilityRole="button" accessibilityLabel={t('media.simulate')} style={styles.simulateLink}>
                      <FlaskIcon size={16} color={colors.simulation} />
                      <Text variant="captionStrong" color="simulation" style={{ marginLeft: 4 }}>
                        {t('media.simulate')}
                      </Text>
                    </Pressable>
                  ) : undefined
                }
              />
              <Text variant="small" color="tertiary" style={{ marginBottom: spacing.md }}>
                {t('media.publishedOn', { date: formatLongDate(media.timestamp, language) })}
              </Text>

              {detail.insightsLoading ? (
                <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: spacing.xl }} />
              ) : detail.insightsError && !detail.realInsight ? (
                <ErrorState error={detail.insightsError} onRetry={detail.refetch} compact />
              ) : (
                <>
                  {/* Overview hero (Instagram post insights style) */}
                  <View style={styles.hero}>
                    {OVERVIEW.map((key) => {
                      const m = byKey(key);
                      if (!m) return null;
                      return (
                        <Pressable
                          key={key}
                          onLongPress={() => editor.open({ scope: detail.scope, metric: key, realValue: m.realValue })}
                          onPress={simulation ? () => editor.open({ scope: detail.scope, metric: key, realValue: m.realValue }) : undefined}
                          delayLongPress={300}
                          style={styles.heroCell}
                          accessibilityRole="button"
                          accessibilityLabel={`${t(`metric.${key}`)} ${m.value}`}
                        >
                          <StatCounter value={m.value} variant="heading" weight="700" color={indicators && m.isSimulated ? 'simulation' : 'primary'} />
                          <Text variant="small" color="secondary" align="center" numberOfLines={1}>
                            {t(`metric.${key}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {indicators && detail.realInsight?.source === 'estimated' ? (
                    <View style={[styles.notice, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      <InfoIcon size={14} color={colors.textSecondary} />
                      <Text variant="small" color="secondary" style={{ flex: 1, marginLeft: spacing.sm }}>
                        {t('dashboard.estimatedNotice')}
                      </Text>
                    </View>
                  ) : null}
                  {er !== null ? (
                    <Card style={{ marginTop: spacing.md, paddingVertical: spacing.md }} tone={indicators ? 'simulation' : 'default'}>
                      <View style={styles.erRow}>
                        <View>
                          <Text variant="caption" color="secondary">
                            {t('metric.engagementRate')}
                          </Text>
                          <Text variant="small" color="tertiary">
                            {formula === 'reach' ? t('analytics.byReach') : t('analytics.byFollowers')}
                          </Text>
                        </View>
                        <Text variant="heading" weight="700" color={indicators ? 'simulation' : 'primary'}>
                          {formatPercent(er, language, 2).replace('+', '')}
                        </Text>
                      </View>
                    </Card>
                  ) : null}

                  {section(ENGAGEMENT, t('media.engagement'))}
                  {section(PROFILE, t('metric.profile_visits'))}
                  {media.type === 'REEL' ? section(REEL, t('feed.reel')) : null}
                  {media.type === 'REEL' && detail.realInsight?.retention ? (
                    <View style={styles.section}>
                      <Text variant="captionStrong" color="secondary" style={styles.sectionLabel}>
                        {upperCase(t('media.retention'), language)}
                      </Text>
                      <RetentionChart retention={detail.realInsight.retention} />
                    </View>
                  ) : media.type === 'REEL' ? (
                    <View style={styles.section}>
                      <Text variant="captionStrong" color="secondary" style={styles.sectionLabel}>
                        {upperCase(t('media.retention'), language)}
                      </Text>
                      <Text variant="caption" color="tertiary">
                        {t('reels.retentionUnsupported')}
                      </Text>
                    </View>
                  ) : null}
                  {indicators && missing.length > 0 ? (
                    <View style={[styles.notice, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: spacing.lg }]}>
                      <InfoIcon size={14} color={colors.textSecondary} />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text variant="captionStrong" color="secondary">
                          {t('media.unsupportedTitle')}
                        </Text>
                        <Text variant="small" color="tertiary">
                          {t('media.unsupportedBody')} ({missing.map((k) => t(`metric.${k}`)).join(', ')})
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {indicators ? (
                    <Button title={t('media.simulate')} variant="simulation" onPress={() => router.push(`/simulation/media/${media.id}`)} style={{ marginTop: spacing.xl }} icon={<FlaskIcon size={16} color="#fff" />} />
                  ) : null}
                </>
              )}
            </View>

            {/* Comments (only when the source provides them) */}
            {comments && comments.length > 0 ? (
              <View style={styles.comments}>
                <Divider />
                <Text variant="captionStrong" color="secondary" style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
                  {upperCase(t('media.comments'), language)}
                </Text>
                {comments.map((c) => (
                  <View key={c.id} style={styles.comment}>
                    <Avatar uri={c.avatarUrl} size={32} name={c.username} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="feed">
                        <Text variant="feedStrong">{c.username} </Text>
                        {c.text}
                      </Text>
                      <Text variant="small" color="secondary" style={{ marginTop: 2 }}>
                        {formatRelativeShort(c.timestamp, language)}
                        {c.likeCount > 0 ? `  ·  ${c.likeCount} ${t('metric.likes').toLowerCase()}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {media.isSimulated && indicators ? (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
                <Chip label={t('feed.simulatedPost')} tone="simulation" />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <PostOptionsSheet media={options} onClose={() => setOptions(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  insightsButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insights: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  simulateLink: { flexDirection: 'row', alignItems: 'center' },
  hero: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md },
  heroCell: { alignItems: 'center', flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  erRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { marginTop: spacing.lg },
  sectionLabel: { letterSpacing: 0.4, marginBottom: spacing.xs },
  comments: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  comment: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
});
