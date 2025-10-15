import factorial from './factorial';

describe('factorial', () => {
  // Existing tests...
  it('should return 1 for factorial of 0', () => {
    expect(factorial(0)).toBe(1);
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 6],
    [5, 120],
    [10, 3628800]
  ])('should correctly calculate factorial of %i', (input, expected) => {
    expect(factorial(input)).toBe(expected);
  });

  it('should throw an error for negative numbers', () => {
    expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers');
    expect(() => factorial(-5)).toThrow('Factorial is not defined for negative numbers');
  });

  it('should handle relatively large numbers', () => {
    expect(factorial(20)).toBe(2432902008176640000);
  });

  it('should handle floating point inputs by truncating to integer', () => {
    expect(factorial(4.7)).toBe(24);
    expect(factorial(4.2)).toBe(24);
  });

  it('should handle floating point inputs near integers', () => {
    expect(factorial(5.0)).toBe(120);
  });

  // Additional comprehensive tests
  it('should warn about non-integer inputs', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    factorial(4.5);
    
    expect(consoleSpy).toHaveBeenCalledWith('Input 4.5 is not an integer. Rounding down to 4.');
    
    consoleSpy.mockRestore();
  });

  it('should throw an error for numbers causing numeric overflow', () => {
    // A number large enough to cause overflow
    expect(() => factorial(171)).toThrow('Factorial of 171 would cause numeric overflow');
  });

  it('should handle very small floating point inputs', () => {
    expect(factorial(0.1)).toBe(1);
    expect(factorial(0.9)).toBe(1);
  });
});