#!/usr/bin/env node
/**
 * @tool math_calculator
 * @description Perform basic math operations
 * @param {string} operation - The operation (add, subtract, multiply, divide)
 * @param {number} a - First number
 * @param {number} b - Second number
 */

import {readFileSync} from 'fs';

const input = JSON.parse(readFileSync(0, 'utf-8'));
const { operation, a, b } = input;

let result;
switch (operation) {
  case 'add':
    result = a + b;
    break;
  case 'subtract':
    result = a - b;
    break;
  case 'multiply':
    result = a * b;
    break;
  case 'divide':
    result = b !== 0 ? a / b : 'Error: Division by zero';
    break;
  default:
    result = 'Unknown operation';
}

console.log(JSON.stringify({ result, operation, a, b }));
