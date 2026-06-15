import { formatTime } from '../time';

describe('time utility', () => {
  describe('formatTime', () => {
    it('formats 0ms correctly as 0:00', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats less than a minute correctly', () => {
      expect(formatTime(45000)).toBe('0:45');
      expect(formatTime(5000)).toBe('0:05');
    });

    it('formats exactly one minute correctly', () => {
      expect(formatTime(60000)).toBe('1:00');
    });

    it('formats multiple minutes and seconds correctly', () => {
      expect(formatTime(125000)).toBe('2:05');
      expect(formatTime(3599000)).toBe('59:59');
    });

    it('formats hours into minutes correctly', () => {
      expect(formatTime(3600000)).toBe('60:00');
      expect(formatTime(3665000)).toBe('61:05');
    });
  });
});
