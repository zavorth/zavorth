import {
  safeParseInt,
  safeParseIntBounded,
} from '../../src/ai-gateway/shared/utils/safeParseInt';

describe('Config Helpers', () => {
  describe('safeParseInt', () => {
    it('should parse valid integer', () => {
      expect(safeParseInt('42', 0)).toBe(42);
    });

    it('should return default for NaN', () => {
      expect(safeParseInt('abc', 10)).toBe(10);
    });

    it('should return default for empty string', () => {
      expect(safeParseInt('', 5)).toBe(5);
    });

    it('should return default for null', () => {
      expect(safeParseInt(null, 7)).toBe(7);
    });

    it('should return default for undefined', () => {
      expect(safeParseInt(undefined, 9)).toBe(9);
    });

    it('should parse negative numbers', () => {
      expect(safeParseInt('-5', 0)).toBe(-5);
    });

    it('should parse zero', () => {
      expect(safeParseInt('0', 10)).toBe(0);
    });
  });

  describe('safeParseIntBounded', () => {
    it('should clamp to min', () => {
      expect(safeParseIntBounded('-10', 0, 0, 100)).toBe(0);
    });

    it('should clamp to max', () => {
      expect(safeParseIntBounded('200', 0, 0, 100)).toBe(100);
    });

    it('should return value within range', () => {
      expect(safeParseIntBounded('50', 0, 0, 100)).toBe(50);
    });

    it('should return default for invalid input', () => {
      expect(safeParseIntBounded('abc', 25, 0, 100)).toBe(25);
    });
  });
});
