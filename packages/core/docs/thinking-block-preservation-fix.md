# Thinking Block Preservation Fix

## Problem Summary

When using Anthropic's interleaved-thinking API (`claude-sonnet-4-5`), multi-turn conversations would fail with the error:

```
messages.N.content.0.type: Expected `thinking` or `redacted_thinking`, but found `text`.
When `thinking` is enabled, a final `assistant` message must start with a thinking block.
```

Additionally, thinking content was not being displayed to users even when thinking blocks were present.

## Root Causes

### Issue 1: Thinking Blocks Were Lost in Format Conversion

**Problem:** The `formatResponse()` method was extracting only text content from API responses, **filtering out thinking blocks**:

```typescript
// BEFORE (WRONG)
const textContent = response.content
  .filter((c) => c.type === 'text')  // ❌ Excludes thinking blocks!
  .map((c) => c.text)
  .join('');

return {
  role: 'assistant',
  content: textContent,
};
```

When this message was sent back to the API in the next turn, Claude rejected it because thinking blocks were missing.

**Fix:** Preserve raw content blocks when thinking is present:

```typescript
// AFTER (CORRECT)
const hasThinkingBlocks = response.content.some(
  (c) => c.type === 'thinking' || c.type === 'redacted_thinking'
);

const message: Message = {
  role: 'assistant',
  content: textContent || (toolCalls.length > 0 ? undefined : ''),
};

// Preserve raw content blocks if thinking is present
if (hasThinkingBlocks) {
  message.raw_content = response.content;
}
```

### Issue 2: logThinkingMetrics Returned Early with Zero Tokens

**Problem:** The `logThinkingMetrics()` function returned early when `thinkingTokens` was 0:

```typescript
// BEFORE (WRONG)
export function logThinkingMetrics(
  logger: AgentLogger | undefined,
  thinkingTokens: number,
  thinkingBlocks?: ThinkingContentBlock[]
): void {
  if (!logger || !thinkingTokens) return;  // ❌ Returns when tokens=0
```

Interleaved thinking doesn't report `thinking_tokens` in usage metrics, so this always returned early without displaying thinking content.

**Fix:** Check for thinking blocks instead of token count:

```typescript
// AFTER (CORRECT)
export function logThinkingMetrics(
  logger: AgentLogger | undefined,
  thinkingTokens: number,
  thinkingBlocks?: ThinkingContentBlock[]
): void {
  if (!logger) return;

  // Allow logging even if thinkingTokens is 0 (interleaved thinking may not report token count)
  if (!thinkingBlocks || thinkingBlocks.length === 0) return;
```

## Implementation Details

### Changes to `base-types.ts`

Added `raw_content` field to preserve original API response:

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  // Raw content blocks from provider (preserved for thinking blocks, etc.)
  raw_content?: unknown;
}
```

### Changes to `anthropic-provider.ts`

1. **formatResponse()** - Preserve raw content when thinking blocks exist
2. **formatMessagesWithCaching()** - Use raw content when available instead of reconstructing:

```typescript
// Handle assistant messages
if (msg.role === 'assistant') {
  // If raw content blocks are present (e.g., from thinking), use them directly
  if (msg.raw_content && Array.isArray(msg.raw_content)) {
    formatted.push({
      role: 'assistant',
      content: msg.raw_content as Anthropic.ContentBlock[],
    });
    continue;
  }

  // Otherwise, reconstruct content from tool calls and text
  // ...
}
```

### Changes to `thinking-utils.ts`

Updated early return logic to check for thinking blocks instead of token count:

```typescript
// Before
if (!logger || !thinkingTokens) return;

// After
if (!logger) return;
if (!thinkingBlocks || thinkingBlocks.length === 0) return;
```

## Test Coverage

### `anthropic-provider.test.ts`

Added 11 new tests covering:

1. **formatResponse - thinking block preservation (4 tests)**
   - Preserves thinking blocks in `raw_content` when present
   - Does not add `raw_content` when no thinking blocks
   - Preserves `redacted_thinking` blocks
   - Preserves thinking blocks with tool calls

2. **formatMessagesWithCaching - raw_content usage (3 tests)**
   - Uses `raw_content` for assistant messages when available
   - Reconstructs content from tool calls when `raw_content` not available
   - Preserves raw_content with multiple thinking blocks

3. **extractThinkingBlocks (4 tests)**
   - Extracts thinking blocks from content
   - Extracts `redacted_thinking` blocks
   - Returns empty array when no thinking blocks
   - Extracts multiple thinking blocks

### `thinking-utils.test.ts`

Created comprehensive test suite with 22 tests covering:

1. **Early return conditions (3 tests)**
   - Returns early when logger is undefined
   - Returns early when blocks array is undefined
   - Returns early when blocks array is empty

2. **Thinking block display with zero token count (2 tests)**
   - ✅ **KEY FIX TEST:** Displays thinking content even when token count is 0
   - Displays thinking content with non-zero token count

3. **Multiple thinking blocks (2 tests)**
   - Combines multiple thinking blocks
   - Handles mix of thinking and redacted_thinking

4. **Redacted thinking blocks (2 tests)**
   - Shows redacted indicator for redacted blocks
   - Uses appropriate icon for redacted thinking

5. **Content formatting (5 tests)**
   - Trims whitespace from thinking content
   - Preserves newlines within content
   - Handles empty thinking content
   - Handles thinking block without content property

6. **Icon and label selection (2 tests)**
   - Uses brain icon for normal thinking
   - Uses brain icon when token count is provided

7. **Integration scenarios (3 tests)**
   - Handles typical interleaved thinking scenario (0 tokens, content present)
   - Handles extended thinking scenario (tokens reported, content present)
   - Handles multiple sequential calls

8. **Edge cases (3 tests)**
   - Handles very long thinking content
   - Handles special characters
   - Handles negative/extreme token counts

## Test Results

```
✓ anthropic-provider.test.ts (16 tests) - All Pass
✓ thinking-utils.test.ts (22 tests) - All Pass
✓ All unit tests (441 tests) - All Pass
```

## Verification

The fix was verified with the `coding-team` example:

```bash
npm run coding-team
```

**Results:**
- ✅ No more "Expected thinking block" errors
- ✅ Thinking content displayed to users with 🧠 icon
- ✅ Multi-turn conversations work correctly
- ✅ Cache efficiency remains excellent (>100,000% in some cases)

**Example thinking output:**
```
🧠 Agent Thinking:
Good, I can see the project structure. There's a `src` directory where I need
to place the factorial function. Let me explore what's in the src directory
to understand any existing patterns.

📊 Thinking Metrics: 0 tokens used for reasoning
```

## API Compatibility

This fix is compatible with:

- **Interleaved Thinking** (`interleaved-thinking-2025-05-14` beta)
  - Used by `claude-sonnet-4-5` and newer Claude 4 models
  - Does NOT report `thinking_tokens` in usage metrics
  - Requires thinking blocks in all assistant messages

- **Extended Thinking** (`extended-thinking-2024-12-12` beta)
  - Used by Claude 3.7 models
  - Reports `thinking_tokens` in usage metrics
  - Also requires thinking block preservation

## Key Insights

1. **Don't lose information during format conversion** - Preserve the raw API response structure when it contains important metadata
2. **Interleaved thinking != Extended thinking** - Different beta features with different token reporting behaviors
3. **Zero token count doesn't mean no thinking** - Some models don't report thinking token usage in metrics
4. **Test both scenarios** - Test with and without token counts reported

## Files Modified

- `packages/core/src/base-types.ts` - Added `raw_content` field
- `packages/core/src/providers/anthropic-provider.ts` - Preserve and use raw content
- `packages/core/src/providers/thinking-utils.ts` - Fixed early return logic

## Files Created

- `packages/core/tests/unit/providers/thinking-utils.test.ts` - Comprehensive test suite (22 tests)

## Files Updated

- `packages/core/tests/unit/providers/anthropic-provider.test.ts` - Added thinking block tests (11 tests)
