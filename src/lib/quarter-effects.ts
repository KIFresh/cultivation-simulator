/** 每季度自然消退的丹毒量。 */
export const DETOX_PER_QUARTER = 3;

export function decayToxicity(current: number): number {
  return Math.max(0, current - DETOX_PER_QUARTER);
}
