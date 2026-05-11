import { truncate } from '../src/lib/truncate';

describe('truncate', () => {
  it('should return the original string if it is shorter than maxLength', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('should return the original string if it equals maxLength', () => {
    expect(truncate('Hello World', 11)).toBe('Hello World');
  });

  it('should truncate and add ellipsis if string exceeds maxLength', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('should handle empty strings', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('should truncate long strings correctly', () => {
    const longText = 'This is a very long string that needs to be truncated';
    expect(truncate(longText, 20)).toBe('This is a very lo...');
  });

  it('should handle strings with exactly maxLength - 3 characters', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
    expect(truncate('Hello!', 5)).toBe('He...');
  });

  it('should throw error if maxLength is less than 3', () => {
    expect(() => truncate('Hello', 2)).toThrow('maxLength must be at least 3 to accommodate ellipsis');
  });

  it('should handle unicode characters', () => {
    expect(truncate('Café ☕', 6)).toBe('Café ☕');
    expect(truncate('Café ☕ München', 10)).toBe('Café ☕ ...');
  });
});
