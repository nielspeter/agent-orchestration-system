import factorial from '../src/factorial';

describe('Factorial Function', () => {
  test('factorial of 0 should return 1', () => {
    expect(factorial(0)).toBe(1);
  });

  test('factorial of 1 should return 1', () => {
    expect(factorial(1)).toBe(1);
  });

  test('factorial of 5 should return 120', () => {
    expect(factorial(5)).toBe(120);
  });

  test('factorial of negative number should throw an error', () => {
    expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers');
  });
});