import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlayIcon } from '@/components/icons';
import { useTheme } from '@/hooks/useTheme';
import { refreshPublicVideoUrl } from '@/services/instagram/PublicInstagramProvider';
import type { AppMedia } from '@/types/app';

const BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';

/** Player state lives on the native object; it is driven from effects, never during render. */
function drive(player: VideoPlayer, opts: { muted: boolean; paused: boolean }) {
  player.muted = opts.muted;
  if (opts.paused) player.pause();
  else player.play();
}

interface MediaVideoProps {
  /** Post the video belongs to (used to refresh an expired public CDN link). */
  media: AppMedia;
  uri: string;
  /** Cover frame shown until the first frame is ready and whenever playback fails. */
  poster?: string;
  width: number;
  height: number;
  muted: boolean;
  /** Reels: tap to pause. Feed videos never pause, they leave the screen instead. */
  paused?: boolean;
  loop?: boolean;
  contentFit?: 'cover' | 'contain';
}

/**
 * Inline video for the feed, Reels and the post screen. Mount it only for the post
 * that is on screen: every instance owns a native player and starts playing at once.
 * A signed Instagram link that stopped working is refreshed once; after that the
 * cover frame stays, exactly like a post whose video did not load.
 */
export function MediaVideo({ media, uri, poster, width, height, muted, paused = false, loop = true, contentFit = 'cover' }: MediaVideoProps) {
  const { colors } = useTheme();
  const [source, setSource] = useState(uri);
  const [failed, setFailed] = useState(false);
  const refreshed = useRef(false);

  const player = useVideoPlayer({ uri: source }, (p) => {
    p.loop = loop;
    p.muted = muted;
    p.timeUpdateEventInterval = 0;
    if (!paused) p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const ready = status === 'readyToPlay';

  // Re-applied once the source is ready as well: on web a play() issued before the
  // element had its source is dropped, on native it is a harmless no-op.
  useEffect(() => {
    drive(player, { muted, paused });
  }, [player, muted, paused, ready]);

  useEffect(() => {
    if (status !== 'error') return;
    if (refreshed.current) {
      setFailed(true);
      return;
    }
    refreshed.current = true;
    let cancelled = false;
    void refreshPublicVideoUrl(media).then((fresh) => {
      if (cancelled) return;
      if (fresh && fresh !== source) setSource(fresh);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [status, media, source]);

  return (
    <View style={{ width, height, backgroundColor: colors.skeleton }}>
      {!failed ? <VideoView player={player} style={{ width, height }} contentFit={contentFit} nativeControls={false} allowsPictureInPicture={false} /> : null}
      {(!ready || failed) && poster ? (
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit={contentFit} placeholder={{ blurhash: BLURHASH }} cachePolicy="memory-disk" accessibilityIgnoresInvertColors />
      ) : null}
      {paused && ready && !failed ? (
        <View style={styles.pausedOverlay} pointerEvents="none">
          <PlayIcon size={56} color="rgba(255,255,255,0.9)" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pausedOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
