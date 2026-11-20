/**
 * The experience detail's own back decision, read once by the header button.
 *
 * Web has no hardware back and the gesture does not exist on desktop browsers, so
 * the arrow has to answer for both: a stack to pop pops it, and a deep link or a
 * refresh - a stack that does not exist - sends the walker home instead. Extracted
 * as its own function so a test can exercise both branches without mounting a
 * navigator.
 */
export function detailBackAction(
  router: {
    canGoBack(): boolean;
    back(): void;
    replace(path: Parameters<import('expo-router').ImperativeRouter['replace']>[0]): void;
  },
  homePath: Parameters<import('expo-router').ImperativeRouter['replace']>[0],
): void {
  if (router.canGoBack()) router.back();
  else router.replace(homePath);
}
