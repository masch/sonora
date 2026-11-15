import type { ExperienceFormat } from '@/data/experiences';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export interface UseInstructionsAudioResult {
  /**
   * The configured instructions node for this format, or null when the
   * remote config has none. Both fields always travel together: the shared
   * schema requires slug and audioUrl in the same node, so a non-null node
   * guarantees both.
   */
  instructions: { slug: string; audioUrl: string } | null;
  /** Loading while the remote config has not answered yet */
  loading: boolean;
  /** Error state when the remote config fetch fails */
  error: Error | null;
}

/**
 * Hook that resolves the instructions audio for one experience format from the
 * remote config payload (`GET /config`).
 *
 * The config node is `experiences.<format>.instructions` with `slug` and
 * `audioUrl`; the slug doubles as the download-cache track id, so it must stay
 * stable across releases. Returns null while loading and when the format has
 * no instructions node — the player renders a loading card in the first case
 * and nothing in the second.
 */
export function useInstructionsAudio(format: ExperienceFormat): UseInstructionsAudioResult {
  const config = useRemoteConfigStore((state) => state.config);
  const isLoading = useRemoteConfigStore((state) => state.isLoading);
  const error = useRemoteConfigStore((state) => state.error);

  const node = config.experiences?.[format]?.instructions ?? null;
  // `audioUrl` is derived by `/config` from the compiled `audioKey` and is not
  // part of the payload type. A compiled default without a live `/config`
  // answer carries the key but no derived url, so it is not playable and the
  // node stays null.
  const audioUrl = (node as { audioUrl?: unknown } | null)?.audioUrl;

  return {
    instructions:
      node && typeof audioUrl === 'string' && audioUrl.length > 0
        ? { slug: node.slug, audioUrl }
        : null,
    loading: isLoading,
    error,
  };
}
