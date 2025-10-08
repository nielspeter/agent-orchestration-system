import { factorial } from './math-utils';

describe('factorial', () => {
  // Test case for 0!
  it('should return 1 for factorial of 0', () => {
    expect(factorial(0)).toBe(1);
  });

  // Test case for 5!
  it('should calculate 5! correctly as 120', () => {
    expect(factorial(5)).toBe(120);
  });

  // Test case for 1!
  it('should return 1 for factorial of 1', () => {
    expect(factorial(1)).toBe(1);
  });

  // Test case for larger number
  it('should calculate 7! correctly', () => {
    expect(factorial(7)).toBe(7 * 6 * 5 * 4 * 3 * 2 * 1);
  });

  // Test case for negative number
  it('should throw an error for negative numbers', () => {
    expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers');
  });

  // Test case for non-integer input (if needed)
  it('should handle floating point numbers by truncating', () => {
    expect(factorial(4.7)).toBe(24); // Should be the same as 4!
  });

  // Edge case: very large number (optional, depends on implementation)
  it('should handle relatively large numbers', () => {
    expect(factorial(10)).toBe(3628800);
  });
});
