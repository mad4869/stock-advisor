import { describe, it, expect } from 'vitest';
import { getIDXTickSize, roundToIDXTick } from '@/lib/tickUtils';

describe('tickUtils', () => {
  describe('getIDXTickSize', () => {
    it('should return correct tick sizes for various price ranges', () => {
      expect(getIDXTickSize(50)).toBe(1);
      expect(getIDXTickSize(199)).toBe(1);
      expect(getIDXTickSize(200)).toBe(2);
      expect(getIDXTickSize(350)).toBe(2);
      expect(getIDXTickSize(499)).toBe(2);
      expect(getIDXTickSize(500)).toBe(5);
      expect(getIDXTickSize(1200)).toBe(5);
      expect(getIDXTickSize(1999)).toBe(5);
      expect(getIDXTickSize(2000)).toBe(10);
      expect(getIDXTickSize(3500)).toBe(10);
      expect(getIDXTickSize(4999)).toBe(10);
      expect(getIDXTickSize(5000)).toBe(25);
      expect(getIDXTickSize(10000)).toBe(25);
    });
  });

  describe('roundToIDXTick', () => {
    it('should round prices correctly according to IDX tick size rules', () => {
      // Tick size 1
      expect(roundToIDXTick(50.4)).toBe(50);
      expect(roundToIDXTick(50.6)).toBe(51);

      // Tick size 2
      expect(roundToIDXTick(250)).toBe(250);
      expect(roundToIDXTick(251)).toBe(252);
      expect(roundToIDXTick(250.9)).toBe(250);

      // Tick size 5
      expect(roundToIDXTick(1001)).toBe(1000);
      expect(roundToIDXTick(1002.4)).toBe(1000);
      expect(roundToIDXTick(1003)).toBe(1005);

      // Tick size 10
      expect(roundToIDXTick(3004)).toBe(3000);
      expect(roundToIDXTick(3005)).toBe(3010);
      expect(roundToIDXTick(3006)).toBe(3010);

      // Tick size 25
      expect(roundToIDXTick(7512)).toBe(7500);
      expect(roundToIDXTick(7513)).toBe(7525);
      expect(roundToIDXTick(7537)).toBe(7525);
      expect(roundToIDXTick(7538)).toBe(7550);

      // Zero and negative boundary conditions
      expect(roundToIDXTick(0)).toBe(0);
      expect(roundToIDXTick(-100)).toBe(0);
    });
  });
});
