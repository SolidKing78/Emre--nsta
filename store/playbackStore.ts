import { create } from 'zustand';

/**
 * Session-only playback preferences. Instagram remembers whether you turned the
 * sound on for feed videos until the app restarts; Reels always play with sound.
 */
interface PlaybackState {
  /** Feed videos start muted; tapping one toggles this for every feed video. */
  feedMuted: boolean;
  setFeedMuted: (muted: boolean) => void;
  toggleFeedMuted: () => void;
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  feedMuted: true,
  setFeedMuted: (feedMuted) => set({ feedMuted }),
  toggleFeedMuted: () => set((s) => ({ feedMuted: !s.feedMuted })),
}));
