/**
 * Gameplay over-scans the cover-fitted stage background slightly so the combat
 * camera shake never reveals the background edges. Any debug scene that previews
 * the stage to position gameplay elements against it — most importantly the Lane
 * Editor — must cover-fit the background with the SAME over-scan, otherwise the
 * floor sits at a different screen position than in-game and lanes aligned to it
 * will not match the actual gameplay foot positions.
 */
export const BACKGROUND_COVER_OVERSCAN = 1.08;

/** Cover-fit scale (fills the view, preserves aspect) with the shared over-scan. */
export function getBackgroundCoverScale(
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number
): number {
  return (
    Math.max(viewWidth / frameWidth, viewHeight / frameHeight) *
    BACKGROUND_COVER_OVERSCAN
  );
}
