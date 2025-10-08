/**
 * Calculates the factorial of a non-negative integer.
 *
 * @param {number} n - The non-negative integer to calculate factorial for.
 * @returns {number} The factorial of the input number.
 * @throws {Error} If the input is a negative number.
 *
 * @example
 * factorial(0);  // Returns 1
 * factorial(5);  // Returns 120
 * factorial(-1); // Throws an error
 */
export function factorial(n: number): number {
  // Check for negative numbers
  if (n < 0) {
    throw new Error('Factorial is not defined for negative numbers');
  }

  // Base cases: 0! and 1! are 1
  if (n <= 1) {
    return 1;
  }

  // Iterative approach to calculate factorial
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}
