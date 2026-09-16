import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/common/Avatar';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Text } from '@/components/common/Text';
import { ChevronDownIcon, HeartIcon, ImageIcon, StickerIcon, VerifiedIcon } from '@/components/icons';
import { fontStyles } from '@/constants/fonts';
import { spacing } from '@/constants/theme';
import { useAccount, useComments } from '@/features/instagram/hooks';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { AppComment, AppMedia } from '@/types/app';
import { formatRelativeShort } from '@/utils/date';
import { formatCompact } from '@/utils/format';

const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

interface CommentsSheetProps {
  media: AppMedia | null;
  onClose: () => void;
}

type SortMode = 'forYou' | 'newest';

function CommentRow({ comment }: { comment: AppComment }) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const [liked, setLiked] = useState(false);
  const likeCount = comment.likeCount + (liked ? 1 : 0);
  return (
    <View style={styles.row}>
      <Avatar uri={comment.avatarUrl} size={40} name={comment.username} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text variant="feedStrong" numberOfLines={1}>
            {comment.username}
          </Text>
          {comment.isVerified ? <VerifiedIcon size={12} /> : null}
          <Text variant="caption" color="secondary" style={{ marginLeft: 6 }}>
            {formatRelativeShort(comment.timestamp, language)}
          </Text>
        </View>
        <Text variant="feed" style={styles.rowText}>
          {comment.text}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('comments.reply')} hitSlop={6}>
          <Text variant="captionStrong" color="secondary" style={styles.reply}>
            {t('comments.reply')}
          </Text>
        </Pressable>
        {comment.replyCount ? (
          <Pressable style={styles.repliesRow} accessibilityRole="button" accessibilityLabel={t('comments.viewReplies', { n: comment.replyCount })}>
            <View style={[styles.repliesLine, { backgroundColor: colors.borderStrong }]} />
            <Text variant="captionStrong" color="secondary">
              {t('comments.viewReplies', { n: comment.replyCount })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => {
          triggerHaptic('light');
          setLiked((v) => !v);
        }}
        hitSlop={10}
        style={styles.likeCol}
        accessibilityRole="button"
        accessibilityLabel={t('metric.likes')}
      >
        <HeartIcon filled={liked} color={liked ? colors.like : colors.textSecondary} size={16} strokeWidth={1.8} />
        {likeCount > 0 ? (
          <Text variant="small" color="secondary" style={{ marginTop: 4 }}>
            {formatCompact(likeCount, language)}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Instagram's comments bottom sheet: title, "Senin için ˅" sort, comment rows, quick emoji row and composer. */
export function CommentsSheet({ media, onClose }: CommentsSheetProps) {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data: account } = useAccount();
  const [sort, setSort] = useState<SortMode>('forYou');
  const [draft, setDraft] = useState('');
  const query = useComments(media && !media.isSimulated ? media.id : undefined);

  const comments = useMemo(() => {
    const list = query.data ?? [];
    if (sort === 'newest') return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return [...list].sort((a, b) => b.likeCount + (b.replyCount ?? 0) * 3 - (a.likeCount + (a.replyCount ?? 0) * 3));
  }, [query.data, sort]);

  return (
    <BottomSheet visible={media !== null} onClose={onClose} title={t('comments.title')} maxHeightRatio={0.88} disableGesture>
      <View style={styles.sortRow}>
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            setSort((s) => (s === 'forYou' ? 'newest' : 'forYou'));
          }}
          style={styles.sortButton}
          accessibilityRole="button"
          accessibilityLabel={t(sort === 'forYou' ? 'comments.forYou' : 'comments.newest')}
        >
          <Text variant="feedStrong" color="secondary">
            {t(sort === 'forYou' ? 'comments.forYou' : 'comments.newest')}
          </Text>
          <ChevronDownIcon size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommentRow comment={item} />}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text variant="title" align="center">
                {t('comments.empty')}
              </Text>
              <Text variant="caption" color="secondary" align="center" style={{ marginTop: 4 }}>
                {t('comments.emptyBody')}
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.emojiRow}>
          {QUICK_EMOJI.map((emoji) => (
            <Pressable key={emoji} onPress={() => setDraft((d) => d + emoji)} hitSlop={6} accessibilityRole="button" accessibilityLabel={emoji}>
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <Avatar uri={account?.profilePictureUrl} size={40} name={account?.username} />
          <View style={[styles.inputBox, { borderColor: colors.borderStrong }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('comments.placeholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text }]}
              accessibilityLabel={t('comments.placeholder')}
            />
            <ImageIcon size={22} color={colors.text} strokeWidth={1.6} />
            <View style={{ width: spacing.md }} />
            <StickerIcon size={22} color={colors.text} />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sortRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBody: { flex: 1, marginLeft: spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowText: { marginTop: 2, fontSize: 15, lineHeight: 20 },
  reply: { marginTop: 6 },
  repliesRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  repliesLine: { width: 26, height: StyleSheet.hairlineWidth, marginRight: spacing.md },
  likeCol: { alignItems: 'center', marginLeft: spacing.md, paddingTop: 6, minWidth: 24 },
  empty: { paddingVertical: 48, paddingHorizontal: spacing.xl },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  emoji: { fontSize: 28, lineHeight: 34 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, height: 46, paddingHorizontal: spacing.lg },
  input: { flex: 1, fontSize: 15, paddingVertical: 0, marginRight: spacing.sm, ...fontStyles.regular },
});
