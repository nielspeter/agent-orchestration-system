/**
 * Common primitive types used throughout the application
 */

// Basic type aliases
export type ID = string;
export type UUID = string;

// JSON types
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export type JSONArray = JSONValue[];

// Utility types
export type Optional<T> = T | undefined;
