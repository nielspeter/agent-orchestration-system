/**
 * Calculates the factorial of a non-negative number.
 * 
 * @param {number} n - The non-negative number to calculate factorial for
 * @returns {number} The factorial of the input number
 * @throws {Error} If the input is negative or would cause numeric overflow
 * @throws {Error} If the input is not an integer (will be rounded down)
 */
function factorial(n: number): number {
  // Validate input is non-negative
  if (n < 0) {
    throw new Error("Factorial is not defined for negative numbers");
  }

  // Round non-integer inputs and warn
  const intN = Math.floor(n);
  if (intN !== n) {
    console.warn(`Input ${n} is not an integer. Rounding down to ${intN}.`);
  }

  // Base cases
  if (intN === 0 || intN === 1) {
    return 1;
  }

  // Iterative implementation with overflow protection
  let result = 1;
  for (let i = 2; i <= intN; i++) {
    // Check for potential overflow before multiplication
    if (result > Number.MAX_SAFE_INTEGER / i) {
      throw new Error(`Factorial of ${intN} would cause numeric overflow`);
    }
    result *= i;
  }

  return result;
}

export default factorial;