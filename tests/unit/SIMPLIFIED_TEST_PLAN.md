# Simplified POC Test Plan

## What We ACTUALLY Need to Test (MVP/POC)

### Keep Existing (2 files)
1. **structure.test.ts** - ✅ Already exists, tests basic system setup
2. **system-builder.test.ts** - ✅ Already exists, tests configuration

### Essential Safety Tests (1 file instead of 3)
Create **core-safety.test.ts** with just:
- Test max iterations limit works (prevent infinite loops)
- Test max depth limit works (prevent infinite recursion)
- Test tools don't execute concurrently when unsafe
- Total: ~5 tests

### Essential Integration (1 file)
Create **basic-integration.test.ts** with:
- Test agent can execute a tool
- Test agent can delegate to another agent
- Test error doesn't crash the system
- Total: ~3 tests

## What to DELETE/SKIP

### Overengineered Tests to Remove:
- ❌ **agent-executor.test.ts** (9 tests) - Too detailed for POC
- ❌ **tool-execution.test.ts** (14 tests) - Too detailed
- ❌ **safety-middleware.test.ts** (17 tests) - Redundant with core-safety
- ❌ **error-handling.test.ts** (22 tests) - Way too many edge cases
- ❌ **conversation-logger.test.ts** (20 tests) - Logging isn't critical for POC
- ❌ **tool-registry.test.ts** (30 tests) - Too many edge cases

## Final Test Suite for POC
- structure.test.ts - 11 tests ✅
- system-builder.test.ts - 14 tests ✅
- core-safety.test.ts - ~5 tests (NEW)
- basic-integration.test.ts - ~3 tests (NEW)

**Total: ~33 tests instead of 137**

## Why This Is Better
1. **Focuses on critical failures** - infinite loops, recursion, crashes
2. **Tests the happy path** - basic functionality works
3. **Ignores edge cases** - not needed for POC
4. **80% less test code to maintain**
5. **Runs faster** - important for development speed

## Implementation
Just create 2 new focused test files and delete the 6 overengineered ones.