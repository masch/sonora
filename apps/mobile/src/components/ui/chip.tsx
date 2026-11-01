import { ThemedText } from '@/components/themed-text';
import { TwPressable } from '@/tw';

/**
 * The two chip surfaces the app actually has.
 *
 * A difference in radius, padding and weight, not in meaning: the format rows are a
 * compact square chip, the theme row is a pill. One prop, because a caller that had to
 * assemble those three together would be hand-rolling the surface again.
 */
export type ChipShape = 'square' | 'pill';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  shape?: ChipShape;
  /**
   * Extra classes for the label only.
   *
   * The two screens that share this chip disagree about the copy's case — the
   * experiences screen title-cases its format names, the world map keeps them as
   * written — so that one difference stays with the caller instead of becoming a
   * variant of the primitive.
   */
  labelClassName?: string;
}

/**
 * Design system chip for a single-select filter: one toggle among siblings.
 *
 * The filter rows used to hand-roll this surface as a styled `TwPressable` twice over,
 * which `AGENTS.md` §1 reserves for compound surfaces (cards, rows, backdrops) and not
 * for a standalone toggle action. Owning it here means the selected/unselected pair and
 * the pressed feedback are written once, so the rows cannot drift apart.
 *
 * It deliberately has no group container: a row is a layout decision of its screen
 * (`flex-row gap-2` vs a horizontal `TwScrollView`), and selection is the caller's state.
 */
export function Chip({
  label,
  selected,
  onPress,
  testID,
  accessibilityLabel,
  shape = 'square',
  labelClassName = '',
}: ChipProps) {
  // The selected chip inverts the theme rather than tinting it: on both screens it is
  // the strongest thing in the row and has to read as a state, not as another option.
  const surface = selected
    ? 'bg-text border-text'
    : 'bg-zinc-200/10 dark:bg-zinc-800/10 border-zinc-300/40 dark:border-zinc-700/40';
  // Both literals on purpose: NativeWind generates a utility only from a class it can
  // read statically, so the two shapes cannot be assembled from pieces at runtime.
  const size = shape === 'pill' ? 'px-4 py-2 rounded-full' : 'px-4 py-1.5 rounded-lg';
  const weight = shape === 'pill' ? 'font-semibold' : 'font-bold';

  return (
    <TwPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      // `selected`, not `checked`: a chip reports which filter is active, and that is the
      // same state the inverted surface already shows.
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`${size} border ${surface} active:opacity-75`}
    >
      <ThemedText
        themeColor={selected ? 'background' : 'text'}
        className={`text-xs ${weight} ${labelClassName}`.trim()}
      >
        {label}
      </ThemedText>
    </TwPressable>
  );
}
