# Balanced Test Plan - What We Should Actually Keep

## Current State (Too Minimal)
- 30 tests total
- Only testing configuration and basic safety
- Missing important core functionality tests

## What We Should Restore (Selective)

### 1. **tool-execution.test.ts** (Keep ~5-7 core tests)
Critical for POC:
- ✅ Test that Write tools execute sequentially (data safety)
- ✅ Test that Read tools can execute concurrently 
- ✅ Test tool timeout enforcement
- ✅ Test handling of tool not found
- ✅ Test tool error doesn't crash system

### 2. **agent-executor.test.ts** (Keep ~3-4 core tests)
Critical for POC:
- ✅ Test middleware pipeline executes in order
- ✅ Test iteration limit is enforced
- ✅ Test depth limit is enforced

### 3. **tool-registry.test.ts** (Keep ~5 basic tests)
Useful for POC:
- ✅ Test tool registration works
- ✅ Test getting tools for an agent
- ✅ Test wildcard permissions (*)
- ✅ Test tool not found handling

## What to Still Skip

### Not Critical for POC:
- ❌ error-handling.test.ts - Too many edge cases
- ❌ conversation-logger.test.ts - Logging details not critical
- ❌ safety-middleware.test.ts - Covered by simpler tests

## Recommended Test Suite

1. **structure.test.ts** - 11 tests ✅
2. **system-builder.test.ts** - 14 tests ✅  
3. **core-safety.test.ts** - 5 tests ✅
4. **tool-execution.test.ts** - ~7 tests (restore selective)
5. **agent-executor.test.ts** - ~4 tests (restore selective)
6. **tool-registry.test.ts** - ~5 tests (restore selective)

**Total: ~46 tests** (vs 137 originally, vs 30 currently)

## Why 46 Tests is the Right Balance

1. **Covers critical paths** without overdoing edge cases
2. **Tests actual functionality** not just configuration
3. **Still runs fast** (<1 second)
4. **Enough coverage** for confidence (~40-50%)
5. **Not overengineered** for POC phase