import { useCallback } from 'react';

import type { PlayableExperience } from '@/data/experiences';
import type { WorldExperience } from '@sonora/shared';

import ExperiencePreviewCard from './experience-preview-card';
import { ClusterPickModal } from './cluster-pick-modal';

/**
 * The world's two overlays over the map: the preview card of the open experience,
 * and the picker for a place that carries several.
 *
 * The two are one conversation, not two widgets: a choice in the picker opens the
 * card, and the card a choice opened owes the walker their list back — the explicit
 * "back to list" button reopens the picker instead of leaving them to find the
 * marker again. A card the walker tapped for themselves has no list behind it, and
 * the button never draws.
 *
 * Living here so `WorldMap` stays at the size the doctor gate allows.
 */
export interface WorldExperienceOverlaysProps {
  readonly experiences: readonly WorldExperience[];
  readonly openedSlug: string | null;
  /** The resolved playable experience, already found by the caller against the payload. */
  readonly opened: PlayableExperience | null;
  readonly onOpenSlug: (slug: string | null) => void;
  readonly pickerSlugs: readonly string[] | null;
  readonly onClosePicker: () => void;
  readonly onPick: (slug: string) => void;
  readonly isShared: (slug: string) => boolean;
  /** Whether the open card was reached through the picker, not by its own tap. */
  readonly openedFromPicker: boolean;
  /** Cancels a flight that is still owed when a card closes without being read. */
  readonly onCancelFlight: () => void;
  /** Opens the picker again for one experience's place: the list the card came from. */
  readonly onRequestPicker: (slug: string) => void;
}

export function WorldExperienceOverlays({
  experiences,
  openedSlug,
  opened,
  onOpenSlug,
  pickerSlugs,
  onClosePicker,
  onPick,
  isShared,
  openedFromPicker,
  onCancelFlight,
  onRequestPicker,
}: WorldExperienceOverlaysProps) {
  const closeCard = useCallback(() => {
    onOpenSlug(null);
    onCancelFlight();
  }, [onOpenSlug, onCancelFlight]);

  /** The card a picker choice opened owes the walker their list back. */
  const backToList = useCallback(() => {
    if (!opened) return;
    onOpenSlug(null);
    onCancelFlight();
    onRequestPicker(opened.slug);
  }, [opened, onOpenSlug, onCancelFlight, onRequestPicker]);

  return (
    <>
      <ExperiencePreviewCard
        experience={opened}
        sharedPlace={opened !== null && isShared(opened.slug)}
        onBackToList={openedFromPicker ? backToList : undefined}
        onDismiss={closeCard}
      />

      <ClusterPickModal
        slugs={pickerSlugs}
        experiences={experiences}
        onDismiss={onClosePicker}
        onPick={onPick}
      />
    </>
  );
}
