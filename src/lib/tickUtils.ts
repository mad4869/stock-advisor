/**
 * Utility functions for IDX stock market price ticks.
 */

export function getIDXTickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

export function roundToIDXTick(price: number): number {
  if (price <= 0) return 0;
  const tick = getIDXTickSize(price);
  return Math.round(price / tick) * tick;
}
