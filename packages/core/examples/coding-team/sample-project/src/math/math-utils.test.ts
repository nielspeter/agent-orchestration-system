import { factorial } from './math-utils';

describe('factorial', () => {
  // Test case for 0!
  it('should return 1 for factorial of 0', () => {
    expect(factorial(0)).toBe(1);
  });

  // Test case for 1!
  it('should return 1 for factorial of 1', () => {
    expect(factorial(1)).toBe(1);
  });

  // Test cases for positive numbers
  it('should calculate factorial correctly for small positive numbers', () => {
    expect(factorial(5)).toBe(120); // 5! = 5 * 4 * 3 * 2 * 1 = 120
    expect(factorial(3)).toBe(6); // 3! = 3 * 2 * 1 = 6
    expect(factorial(4)).toBe(24); // 4! = 4 * 3 * 2 * 1 = 24
  });

  // Test case for larger number
  it('should calculate factorial for larger numbers', () => {
    expect(factorial(10)).toBe(3628800); // 10! = 3,628,800
  });

  // Test case for negative numbers
  it('should throw an error for negative numbers', () => {
    expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers');
    expect(() => factorial(-5)).toThrow('Factorial is not defined for negative numbers');
  });

  // Edge case: very large number (potential overflow)
  it('should handle relatively large numbers without overflow', () => {
    // 20! is a large number but should still be calculable
    expect(factorial(20)).toBe(2432902008176640000);
  });

  // Precision check for floating point behavior
  it('should maintain precision for factorial calculations', () => {
    // Ensure no floating point precision issues
    expect(factorial(7)).toBe(7 * 6 * 5 * 4 * 3 * 2 * 1);
  });
});
