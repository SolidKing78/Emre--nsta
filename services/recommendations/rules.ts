import type { ContentPerformance } from '@/services/analytics/content';
import type { AppAccount, AppMediaInsight } from '@/types/app';
import type { Confidence, Recommendation } from '@/types/recommendation';
import { formatCompact, formatPercent } from '@/utils/format';

/**
 * Deterministic recommendation engine. No LLM, no randomness: the same input
 * always yields the same recommendations. Runs on REAL data only.
 */

export type RuleLanguage = 'tr' | 'en';

export interface RuleInput {
  account: AppAccount;
  items: ContentPerformance[];
  /** Media insights keyed by media id — used for retention-based rules. */
  insights: Record<string, AppMediaInsight | undefined>;
  language: RuleLanguage;
}

const MIN_SAMPLE = 3;

interface Texts {
  reelsTitle: string;
  reelsBody: string;
  reelsEvidence: (reel: string, post: string, delta: string) => string;
  carouselTitle: string;
  carouselBody: string;
  carouselEvidence: (carousel: string, other: string) => string;
  timingTitle: (from: string, to: string) => string;
  timingBody: string;
  timingEvidence: (from: string, to: string, delta: string, n: number) => string;
  savesTitle: string;
  savesBody: string;
  savesEvidence: (ratio: string, caption: string) => string;
  convoTitle: string;
  convoBody: string;
  convoEvidence: (commentsShare: string, savesShare: string) => string;
  hookTitle: string;
  hookBody: string;
  hookEvidence: (strong: string, weak: string) => string;
  hookInsufficient: string;
  consistencyTitle: string;
  consistencyBody: string;
  consistencyEvidence: (gap: string) => string;
  reachTitle: string;
  reachBody: string;
  reachEvidence: (ratio: string) => string;
  insufficientTitle: string;
  insufficientBody: string;
  insufficientEvidence: (n: number, needed: number) => string;
}

const TEXTS: Record<RuleLanguage, Texts> = {
  tr: {
    reelsTitle: 'Reels içeriğine daha fazla ağırlık ver',
    reelsBody: 'Reels içeriklerin, diğer gönderilere göre belirgin şekilde daha fazla hesaba ulaşıyor. Haftalık plana en az bir Reel ekle.',
    reelsEvidence: (reel, post, delta) => `Reel ort. erişim ${reel}, gönderi ort. erişim ${post} (${delta}).`,
    carouselTitle: 'Carousel gönderileri daha fazla kaydediliyor',
    carouselBody: 'Carousel formatı bilgilendirici içerik için güçlü bir kaydetme sinyali veriyor. Rehber ve önce/sonra serilerini carousel olarak paylaş.',
    carouselEvidence: (carousel, other) => `Carousel ort. kaydetme ${carousel}, diğer formatlar ${other}.`,
    timingTitle: (from, to) => `${from}–${to} arasında paylaş`,
    timingBody: 'Bu saat aralığında yayınlanan içeriklerde ortalama etkileşim daha yüksek. Paylaşım saatini bu aralığa kaydırmayı dene.',
    timingEvidence: (from, to, delta, n) => `${from}–${to} arası ${n} içerik, ortalamanın ${delta} üzerinde etkileşim aldı.`,
    savesTitle: 'Bilgilendirici içerik formatı güçlü sinyal veriyor',
    savesBody: 'Erişime göre kaydetme oranı yüksek olan içerikler “tekrar bakılacak” içerik olarak algılanıyor. Bu formatı seri haline getir.',
    savesEvidence: (ratio, caption) => `Kaydetme / erişim oranı ${ratio}: “${caption}”`,
    convoTitle: 'Conversation odaklı içerik',
    convoBody: 'Yorumlar yüksek fakat kaydetme düşük. Bu içerikleri tartışma / soru-cevap formatı olarak sınıflandır ve yorumlara hızlı yanıt ver.',
    convoEvidence: (commentsShare, savesShare) => `Etkileşimin ${commentsShare}’i yorum, yalnızca ${savesShare}’i kaydetme.`,
    hookTitle: 'İlk 3 saniyede güçlü hook kullan',
    hookBody: 'İlk 3 saniyede izleyicisini tutan Reels’ler belirgin şekilde daha iyi performans gösteriyor. Videoya sonuçla veya soruyla başla.',
    hookEvidence: (strong, weak) => `Güçlü hook’lu Reels ort. görüntülenme ${strong}, zayıf hook’lu ${weak}.`,
    hookInsufficient: 'Hook analizi izlenme (retention) verisi gerektirir; bu kaynak sağlamıyor.',
    consistencyTitle: 'Paylaşım sıklığını artır',
    consistencyBody: 'Gönderiler arasındaki boşluk uzun. Düzenli bir takvim (haftada 3–4 içerik) erişimi istikrarlı hale getirir.',
    consistencyEvidence: (gap) => `Gönderiler arası ortalama ${gap} gün.`,
    reachTitle: 'Takipçi dışı erişimi büyüt',
    reachBody: 'Erişim, takipçi sayısına yakın seyrediyor; keşfet için paylaşılabilir (share) içerik oranını artır.',
    reachEvidence: (ratio) => `Ort. erişim / takipçi oranı ${ratio}.`,
    insufficientTitle: 'Yetersiz veri',
    insufficientBody: 'Güvenilir öneri üretmek için daha fazla içerik gerekiyor.',
    insufficientEvidence: (n, needed) => `${n} içerik bulundu, en az ${needed} gerekli.`,
  },
  en: {
    reelsTitle: 'Put more weight on Reels',
    reelsBody: 'Your Reels reach noticeably more accounts than your other posts. Add at least one Reel to the weekly plan.',
    reelsEvidence: (reel, post, delta) => `Reel avg reach ${reel} vs post avg reach ${post} (${delta}).`,
    carouselTitle: 'Carousels drive more saves',
    carouselBody: 'The carousel format is a strong save signal for informative content. Publish guides and before/after series as carousels.',
    carouselEvidence: (carousel, other) => `Carousel avg saves ${carousel}, other formats ${other}.`,
    timingTitle: (from, to) => `Post between ${from}–${to}`,
    timingBody: 'Content published in this window earns higher average interactions. Try shifting your publishing time.',
    timingEvidence: (from, to, delta, n) => `${n} items posted ${from}–${to} earned ${delta} above the average.`,
    savesTitle: 'Informative format is a strong signal',
    savesBody: 'Content with a high saves-to-reach ratio is perceived as “come back later” material. Turn it into a series.',
    savesEvidence: (ratio, caption) => `Saves / reach ratio ${ratio}: “${caption}”`,
    convoTitle: 'Conversation-focused content',
    convoBody: 'Comments are high but saves are low. Classify these as discussion / Q&A posts and reply quickly to comments.',
    convoEvidence: (commentsShare, savesShare) => `${commentsShare} of interactions are comments, only ${savesShare} are saves.`,
    hookTitle: 'Use a strong hook in the first 3 seconds',
    hookBody: 'Reels that keep viewers through the first 3 seconds perform noticeably better. Open with the result or a question.',
    hookEvidence: (strong, weak) => `Strong-hook Reels avg views ${strong}, weak-hook ${weak}.`,
    hookInsufficient: 'Hook analysis needs retention data, which this source does not provide.',
    consistencyTitle: 'Increase posting frequency',
    consistencyBody: 'Gaps between posts are long. A steady calendar (3–4 items a week) stabilises reach.',
    consistencyEvidence: (gap) => `Average ${gap} days between posts.`,
    reachTitle: 'Grow non-follower reach',
    reachBody: 'Reach hovers around your follower count; increase shareable content to unlock Explore.',
    reachEvidence: (ratio) => `Avg reach / followers ratio ${ratio}.`,
    insufficientTitle: 'Insufficient data',
    insufficientBody: 'More content is needed to produce reliable recommendations.',
    insufficientEvidence: (n, needed) => `${n} items found, at least ${needed} required.`,
  },
};

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function confidenceFor(sample: number, lift: number): Confidence {
  if (sample >= 8 && lift >= 0.4) return 'high';
  if (sample >= 4 && lift >= 0.2) return 'medium';
  return 'low';
}

export function buildRecommendations(input: RuleInput): Recommendation[] {
  const { items, language, account, insights } = input;
  const T = TEXTS[language];
  const out: Recommendation[] = [];
  const fmt = (n: number) => formatCompact(n, language);

  if (items.length < MIN_SAMPLE) {
    return [
      {
        id: 'insufficient',
        type: 'insufficient_data',
        title: T.insufficientTitle,
        description: T.insufficientBody,
        evidence: T.insufficientEvidence(items.length, MIN_SAMPLE),
        confidence: 'low',
        priority: 1,
        insufficientData: true,
      },
    ];
  }

  const reels = items.filter((i) => i.media.type === 'REEL');
  const posts = items.filter((i) => i.media.type === 'IMAGE' || i.media.type === 'VIDEO');
  const carousels = items.filter((i) => i.media.type === 'CAROUSEL_ALBUM');
  const hasReach = items.some((i) => i.available.has('reach'));
  const hasSaves = items.some((i) => i.available.has('saves'));

  // Rule 1 — Reels reach vs posts reach
  if (hasReach && reels.length >= MIN_SAMPLE && posts.length >= MIN_SAMPLE) {
    const reelAvg = avg(reels.map((r) => r.reach));
    const postAvg = avg(posts.map((p) => p.reach));
    if (postAvg > 0 && reelAvg > postAvg * 1.3) {
      const lift = reelAvg / postAvg - 1;
      out.push({
        id: 'format-reels',
        type: 'format',
        title: T.reelsTitle,
        description: T.reelsBody,
        evidence: T.reelsEvidence(fmt(reelAvg), fmt(postAvg), formatPercent(lift * 100, language, 0)),
        confidence: confidenceFor(Math.min(reels.length, posts.length), lift),
        priority: 1,
      });
    }
  }

  // Rule 2 — Carousels produce more saves
  if (hasSaves && carousels.length >= MIN_SAMPLE && items.length - carousels.length >= MIN_SAMPLE) {
    const carouselAvg = avg(carousels.map((c) => c.saves));
    const otherAvg = avg(items.filter((i) => i.media.type !== 'CAROUSEL_ALBUM').map((i) => i.saves));
    if (otherAvg > 0 && carouselAvg > otherAvg * 1.2) {
      out.push({
        id: 'format-carousel',
        type: 'saves',
        title: T.carouselTitle,
        description: T.carouselBody,
        evidence: T.carouselEvidence(fmt(carouselAvg), fmt(otherAvg)),
        confidence: confidenceFor(carousels.length, carouselAvg / otherAvg - 1),
        priority: 3,
      });
    }
  }

  // Rule 3 — Timing (2-hour windows with at least 3 items)
  if (items.length >= 6) {
    const overall = avg(items.map((i) => i.interactions));
    const buckets = new Map<number, ContentPerformance[]>();
    for (const item of items) {
      const hour = new Date(item.media.timestamp).getHours();
      const bucket = Math.floor(hour / 2) * 2;
      buckets.set(bucket, [...(buckets.get(bucket) ?? []), item]);
    }
    let best: { bucket: number; avg: number; n: number } | null = null;
    for (const [bucket, list] of buckets) {
      if (list.length < MIN_SAMPLE) continue;
      const a = avg(list.map((i) => i.interactions));
      if (!best || a > best.avg) best = { bucket, avg: a, n: list.length };
    }
    if (best && overall > 0 && best.avg > overall * 1.15) {
      const from = `${best.bucket.toString().padStart(2, '0')}:00`;
      const to = `${(best.bucket + 2).toString().padStart(2, '0')}:00`;
      const lift = best.avg / overall - 1;
      out.push({
        id: 'timing',
        type: 'timing',
        title: T.timingTitle(from, to),
        description: T.timingBody,
        evidence: T.timingEvidence(from, to, formatPercent(lift * 100, language, 0), best.n),
        confidence: confidenceFor(best.n, lift),
        priority: 2,
      });
    }
  }

  // Rule 4 — High saves / reach on a specific item (informative signal)
  if (hasReach && hasSaves) {
    const candidates = items
      .filter((i) => i.reach > 0)
      .map((i) => ({ item: i, ratio: i.saves / i.reach }))
      .filter((c) => c.ratio >= 0.03)
      .sort((a, b) => b.ratio - a.ratio);
    const top = candidates[0];
    if (top) {
      const caption = top.item.media.caption.split('\n')[0]?.slice(0, 48) ?? '';
      out.push({
        id: `saves-${top.item.media.id}`,
        type: 'saves',
        title: T.savesTitle,
        description: T.savesBody,
        evidence: T.savesEvidence(formatPercent(top.ratio * 100, language, 1).replace('+', ''), caption),
        confidence: candidates.length >= 3 ? 'high' : 'medium',
        priority: 4,
      });
    }
  }

  // Rule 5 — Comments high but saves low → conversation content
  if (hasSaves) {
    const totals = items.reduce(
      (acc, i) => ({ comments: acc.comments + i.comments, saves: acc.saves + i.saves, interactions: acc.interactions + i.interactions }),
      { comments: 0, saves: 0, interactions: 0 },
    );
    if (totals.interactions > 0) {
      const commentsShare = totals.comments / totals.interactions;
      const savesShare = totals.saves / totals.interactions;
      if (commentsShare >= 0.15 && savesShare <= 0.05) {
        out.push({
          id: 'conversation',
          type: 'conversation',
          title: T.convoTitle,
          description: T.convoBody,
          evidence: T.convoEvidence(
            formatPercent(commentsShare * 100, language, 0).replace('+', ''),
            formatPercent(savesShare * 100, language, 0).replace('+', ''),
          ),
          confidence: 'medium',
          priority: 5,
        });
      }
    }
  }

  // Rule 6 — Hook strength (requires retention data)
  const reelsWithRetention = reels
    .map((r) => ({ item: r, retention: insights[r.media.id]?.retention }))
    .filter((r): r is { item: ContentPerformance; retention: number[] } => Array.isArray(r.retention) && r.retention.length > 3);
  if (reels.length >= MIN_SAMPLE) {
    if (reelsWithRetention.length >= MIN_SAMPLE) {
      const scored = reelsWithRetention.map((r) => ({ ...r, hook: r.retention[3] ?? 0 }));
      const strong = scored.filter((r) => r.hook >= 0.75);
      const weak = scored.filter((r) => r.hook < 0.75);
      if (strong.length >= 2 && weak.length >= 2) {
        const strongAvg = avg(strong.map((r) => r.item.views));
        const weakAvg = avg(weak.map((r) => r.item.views));
        if (weakAvg > 0 && strongAvg > weakAvg * 1.2) {
          out.push({
            id: 'hook',
            type: 'hook',
            title: T.hookTitle,
            description: T.hookBody,
            evidence: T.hookEvidence(fmt(strongAvg), fmt(weakAvg)),
            confidence: confidenceFor(scored.length, strongAvg / weakAvg - 1),
            priority: 2,
          });
        }
      }
    } else {
      out.push({
        id: 'hook-insufficient',
        type: 'hook',
        title: T.hookTitle,
        description: T.hookInsufficient,
        evidence: T.insufficientEvidence(reelsWithRetention.length, MIN_SAMPLE),
        confidence: 'low',
        priority: 9,
        insufficientData: true,
      });
    }
  }

  // Rule 7 — Posting consistency
  if (items.length >= 4) {
    const sorted = [...items].sort((a, b) => a.media.timestamp.localeCompare(b.media.timestamp));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const a = new Date(sorted[i - 1]?.media.timestamp ?? 0).getTime();
      const b = new Date(sorted[i]?.media.timestamp ?? 0).getTime();
      gaps.push((b - a) / 86_400_000);
    }
    const gap = avg(gaps);
    if (gap > 5) {
      out.push({
        id: 'consistency',
        type: 'consistency',
        title: T.consistencyTitle,
        description: T.consistencyBody,
        evidence: T.consistencyEvidence(gap.toFixed(1).replace('.', language === 'tr' ? ',' : '.')),
        confidence: gaps.length >= 8 ? 'high' : 'medium',
        priority: 6,
      });
    }
  }

  // Rule 8 — Reach vs followers
  if (hasReach && account.followersCount > 0) {
    const ratio = avg(items.map((i) => i.reach)) / account.followersCount;
    if (ratio < 0.35) {
      out.push({
        id: 'reach',
        type: 'reach',
        title: T.reachTitle,
        description: T.reachBody,
        evidence: T.reachEvidence(ratio.toFixed(2).replace('.', language === 'tr' ? ',' : '.')),
        confidence: items.length >= 8 ? 'medium' : 'low',
        priority: 7,
      });
    }
  }

  return out.sort((a, b) => a.priority - b.priority);
}

export interface HourBucket {
  hour: number;
  count: number;
  avgInteractions: number;
}

/** Interactions by 2-hour publishing window — used by the Growth Lab chart. */
export function interactionsByHour(items: ContentPerformance[]): HourBucket[] {
  const buckets = new Map<number, number[]>();
  for (const item of items) {
    const hour = Math.floor(new Date(item.media.timestamp).getHours() / 2) * 2;
    buckets.set(hour, [...(buckets.get(hour) ?? []), item.interactions]);
  }
  return Array.from({ length: 12 }, (_, i) => {
    const hour = i * 2;
    const values = buckets.get(hour) ?? [];
    return { hour, count: values.length, avgInteractions: avg(values) };
  });
}
