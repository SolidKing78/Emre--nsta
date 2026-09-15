import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricRow } from '@/components/analytics/MetricRow';
import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Card, Chip, Divider, ListRow, SectionTitle } from '@/components/common/Primitives';
import { PromptSheet } from '@/components/common/PromptSheet';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { CheckIcon, ChevronRightIcon, EditIcon, FlaskIcon, ImageIcon, InsightsIcon, PlusSquareIcon } from '@/components/icons';
import { GrowthRateEditor } from '@/components/simulation/GrowthRateEditor';
import { ModeSwitch } from '@/components/simulation/ModeSwitch';
import { SimulationBadge, SimulationBanner } from '@/components/simulation/SimulationBadge';
import { radius, spacing } from '@/constants/theme';
import { flattenMedia, useAccount, useAccountInsights, useMediaFeed } from '@/features/instagram/hooks';
import {
  ACCOUNT_SCOPE,
  useActiveScenario,
  useDisplayMetrics,
  useOverrides,
  useScenarios,
  useSimulatedMedia,
  useSimulationActions,
  useSimulationEnabled,
  useSimulationIndicators,
} from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { countOverrides, useSimulationStore } from '@/store/simulationStore';
import type { AppMetric } from '@/types/app';
import { SIMULATABLE_ACCOUNT_METRICS } from '@/types/simulation';
import { buildDateRange } from '@/utils/date';
import { formatCompact } from '@/utils/format';

export default function SimulationLabScreen() {
  const router = useRouter();
  const { new: newParam } = useLocalSearchParams<{ new?: string }>();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const enabled = useSimulationEnabled();
  const indicators = useSimulationIndicators();
  const actions = useSimulationActions();
  const scenarios = useScenarios();
  const active = useActiveScenario();
  const overrides = useOverrides();
  const simulatedMedia = useSimulatedMedia();
  const [promptMode, setPromptMode] = useState<'new' | 'rename' | null>(newParam ? 'new' : null);
  const [scenarioMenu, setScenarioMenu] = useState<string | null>(null);

  const { data: account } = useAccount();
  const range = useMemo(() => buildDateRange('30d'), []);
  const insights = useAccountInsights(range);
  const feed = useMediaFeed();
  const media = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);

  // Ensure the account namespace exists so the default scenario appears.
  useEffect(() => {
    useSimulationStore.getState().ensureAccount(actions.accountKey);
  }, [actions.accountKey]);

  const baseMetrics = useMemo<AppMetric[]>(() => {
    const fromInsights = insights.data?.metrics ?? [];
    const list: AppMetric[] = [];
    for (const key of SIMULATABLE_ACCOUNT_METRICS) {
      const m = fromInsights.find((x) => x.key === key);
      if (m) list.push(m);
      else if (account) {
        if (key === 'followers') list.push({ key, value: account.followersCount, source: 'api' });
        if (key === 'following') list.push({ key, value: account.followsCount, source: 'api' });
        if (key === 'media_count') list.push({ key, value: account.mediaCount, source: 'api' });
      }
    }
    return list;
  }, [insights.data, account]);
  const metrics = useDisplayMetrics(ACCOUNT_SCOPE, baseMetrics);

  const confirmResetAll = () => {
    Alert.alert(t('sim.resetAll'), t('sim.resetAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: () => {
          actions.resetAll();
          actions.clearProfileOverrides();
          triggerHaptic('warning');
        },
      },
    ]);
  };

  const postOverrideCount = (mediaId: string) => countOverrides(overrides, `media:${mediaId}:`);
  const menuScenario = scenarios.find((s) => s.id === scenarioMenu);

  return (
    <Screen>
      <AppHeader title={t('sim.title')} showBack right={indicators ? <SimulationBadge style={{ marginRight: spacing.sm }} /> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <ModeSwitch style={styles.switch} />
        {indicators ? <SimulationBanner /> : null}
        <View style={[styles.isolation, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <FlaskIcon size={16} color={colors.simulation} />
          <Text variant="small" color="secondary" style={{ flex: 1, marginLeft: spacing.sm }}>
            {t('sim.dataIsolation')}
          </Text>
        </View>

        {/* Scenarios */}
        <SectionTitle
          title={t('sim.scenarios')}
          right={
            <Pressable onPress={() => setPromptMode('new')} accessibilityRole="button" accessibilityLabel={t('sim.newScenario')} style={styles.inlineAction}>
              <PlusSquareIcon size={18} color={colors.primary} />
              <Text variant="captionStrong" color="accent" style={{ marginLeft: 4 }}>
                {t('sim.newScenario')}
              </Text>
            </Pressable>
          }
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenarios}>
          {scenarios.map((s) => {
            const isActive = s.id === active?.id;
            const n = Object.keys(s.overrides).length;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  triggerHaptic('selection');
                  actions.setActiveScenario(s.id);
                }}
                onLongPress={() => setScenarioMenu(s.id)}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={s.name}
                style={[styles.scenario, { borderColor: isActive ? colors.simulation : colors.borderStrong, backgroundColor: isActive ? colors.simulationSoft : colors.background }]}
              >
                <Text variant="captionStrong" color={isActive ? 'simulation' : 'primary'} numberOfLines={1}>
                  {s.name === 'Default' ? t('sim.defaultScenario') : s.name}
                </Text>
                <Text variant="small" color="tertiary">
                  {n > 0 ? t('sim.overrides', { n }) : t('sim.noOverrides')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Growth rate — one percentage drives every metric */}
        <SectionTitle title={t('growthRate.title')} />
        <Card style={styles.card}>
          <GrowthRateEditor previewMetrics={baseMetrics} compact />
        </Card>

        {/* Account metrics */}
        <SectionTitle title={t('sim.accountMetrics')} />
        <Card style={styles.card} tone={indicators ? 'simulation' : 'default'}>
          {metrics.map((m, i) => (
            <MetricRow
              key={m.key}
              metric={m}
              scope={ACCOUNT_SCOPE}
              last={i === metrics.length - 1}
              subtitle={m.isSimulated ? `${t('sim.realValue')}: ${formatCompact(m.realValue, language)}` : undefined}
            />
          ))}
          {metrics.length === 0 ? (
            <Text variant="caption" color="secondary">
              {t('common.loading')}
            </Text>
          ) : null}
        </Card>
        <Text variant="small" color="tertiary" style={styles.hint}>
          {t('sim.longPressHint')}
        </Text>

        {/* Profile edits */}
        <SectionTitle title={t('sim.editProfile')} />
        <View style={[styles.list, { borderColor: colors.borderStrong }]}>
          <ListRow title={t('profile.editSimulatedProfile')} subtitle={t('profile.simulatedProfileHint')} icon={<EditIcon size={22} color={colors.text} />} onPress={() => router.push('/simulation/profile')} />
        </View>

        {/* Posts */}
        <SectionTitle title={t('sim.postMetrics')} />
        <View style={[styles.list, { borderColor: colors.borderStrong }]}>
          {media.slice(0, 30).map((m, i) => {
            const n = postOverrideCount(m.id);
            return (
              <View key={m.id}>
                <Pressable onPress={() => router.push(`/simulation/media/${m.id}`)} style={styles.postRow} accessibilityRole="button" accessibilityLabel={m.caption.slice(0, 40)}>
                  <Image source={{ uri: m.thumbnailUrl }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" numberOfLines={1}>
                      {m.caption.split('\n')[0] || t(`type.${m.type}`)}
                    </Text>
                    <Text variant="small" color="secondary">
                      {formatCompact(m.likeCount, language)} {t('metric.likes').toLowerCase()} · {formatCompact(m.commentCount, language)} {t('metric.comments').toLowerCase()}
                    </Text>
                  </View>
                  {n > 0 ? <Chip label={t('sim.overrides', { n })} tone="simulation" small /> : null}
                  <ChevronRightIcon size={16} color={colors.textTertiary} />
                </Pressable>
                {i < Math.min(media.length, 30) - 1 ? <Divider inset={72} /> : null}
              </View>
            );
          })}
          {media.length === 0 ? (
            <Text variant="caption" color="secondary" style={{ padding: spacing.lg }}>
              {t('analytics.noContent')}
            </Text>
          ) : null}
        </View>

        {/* Simulated posts */}
        <SectionTitle
          title={t('sim.simulatedPosts')}
          right={
            <Pressable onPress={() => router.push('/simulation/new-post')} accessibilityRole="button" accessibilityLabel={t('sim.addPost')} style={styles.inlineAction}>
              <ImageIcon size={18} color={colors.primary} />
              <Text variant="captionStrong" color="accent" style={{ marginLeft: 4 }}>
                {t('sim.addPost')}
              </Text>
            </Pressable>
          }
        />
        <View style={[styles.list, { borderColor: colors.borderStrong }]}>
          {simulatedMedia.map((s, i) => (
            <View key={s.id}>
              <Pressable onPress={() => router.push(`/simulation/media/${s.id}`)} style={styles.postRow} accessibilityRole="button" accessibilityLabel={s.caption.slice(0, 40)}>
                <Image source={{ uri: s.localUri }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" numberOfLines={1}>
                    {s.caption || t(`type.${s.type}`)}
                  </Text>
                  <Text variant="small" color="secondary">
                    {formatCompact(s.likeCount, language)} {t('metric.likes').toLowerCase()} · {formatCompact(s.commentCount, language)} {t('metric.comments').toLowerCase()}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert(t('sim.removePost'), undefined, [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => actions.removeSimulatedMedia(s.id) },
                    ])
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('sim.removePost')}
                >
                  <Text variant="captionStrong" color="danger">
                    {t('common.delete')}
                  </Text>
                </Pressable>
              </Pressable>
              {i < simulatedMedia.length - 1 ? <Divider inset={72} /> : null}
            </View>
          ))}
          {simulatedMedia.length === 0 ? (
            <Text variant="caption" color="secondary" style={{ padding: spacing.lg }}>
              {t('sim.addPostHint')}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button title={t('sim.compare')} variant="simulation" icon={<InsightsIcon size={18} color="#fff" />} onPress={() => router.push('/simulation/compare')} />
          <Button title={t('sim.resetAll')} variant="secondary" onPress={confirmResetAll} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>

      <PromptSheet
        visible={promptMode !== null}
        title={promptMode === 'rename' ? t('common.rename') : t('sim.newScenario')}
        placeholder={t('sim.scenarioName')}
        initialValue={promptMode === 'rename' ? menuScenario?.name ?? '' : ''}
        onClose={() => setPromptMode(null)}
        onConfirm={(name) => {
          if (promptMode === 'rename' && menuScenario) actions.renameScenario(menuScenario.id, name);
          else {
            actions.createScenario(name);
            if (!enabled) actions.setEnabled(true);
          }
          triggerHaptic('success');
          setPromptMode(null);
          setScenarioMenu(null);
        }}
      />

      <BottomSheet visible={Boolean(scenarioMenu) && promptMode === null} onClose={() => setScenarioMenu(null)} title={menuScenario?.name}>
        <ListRow title={t('sim.activeScenario')} chevron={false} right={menuScenario?.id === active?.id ? <CheckIcon size={18} color={colors.primary} /> : null} onPress={() => { if (menuScenario) actions.setActiveScenario(menuScenario.id); setScenarioMenu(null); }} />
        <ListRow title={t('common.rename')} chevron={false} onPress={() => setPromptMode('rename')} />
        <ListRow title={t('common.duplicate')} chevron={false} onPress={() => { if (menuScenario) actions.duplicateScenario(menuScenario.id); setScenarioMenu(null); }} />
        {scenarios.length > 1 ? (
          <ListRow
            title={t('sim.deleteScenario')}
            chevron={false}
            danger
            onPress={() => {
              setScenarioMenu(null);
              if (!menuScenario) return;
              Alert.alert(t('sim.deleteScenario'), t('sim.deleteScenarioConfirm'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: () => actions.deleteScenario(menuScenario.id) },
              ]);
            }}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  isolation: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  inlineAction: { flexDirection: 'row', alignItems: 'center' },
  scenarios: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  scenario: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 120 },
  card: { marginHorizontal: spacing.lg, paddingVertical: spacing.xs },
  hint: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  list: { marginHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden' },
  postRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  thumb: { width: 44, height: 56, borderRadius: radius.sm },
  actions: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl },
});
