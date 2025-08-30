your AgentExecutor is doing way too much (logging, policy checks, orchestration, planning, execution, delegation). A clean way to tame this is a Chain of Responsibility (CoR)/middleware pipeline where each concern lives in its own handler.

Below is a practical refactor plan + sample TypeScript you can drop in.

⸻

What to pull out into handlers

Think of each box as a handler in the chain:
1.	Init & Context Bootstrap
•	Load agent, tools, seed messages, depth indicator.
2.	Depth Guard
•	Enforce MAX_DEPTH.
3.	Iteration Controller
•	Manages the outer loop (or converts to “one-step per call” model if you prefer).
•	Emits WARN_AT and MAX_ITERATIONS checks.
4.	Token Budget Guard
•	Enforce MAX_TOKENS_ESTIMATE.
5.	LLM Invocation
•	Calls provider with messages, returns assistant response.
6.	Tool-Call Planner
•	Groups tool calls into concurrent/sequential batches.
7.	Tool Executor
•	Executes batches; includes Delegation Handler (special-case Task tool) and Normal Tool Runner.
8.	Message Accumulator
•	Appends assistant responses and tool results to the transcript.
9.	Exit & Result
•	Detect “no tool calls”/done, record metrics, flush logs, return content.
10.	Error Handler (catch-all)

	•	Standardizes failures into user-safe messages + logs.

Add cross-cutting Logging Middleware that wraps the chain (or inject logging hooks in each handler).

⸻

Core interfaces

export interface PipelineContext {
agentName: string;
prompt: string;
execContext: ExecutionContext;
startTime: number;

// Shared state carried through the chain
messages: Message[];
agent?: { name: string; description: string; tools?: any[] };
tools?: ReturnType<ToolRegistry['filterForAgent']>;
response?: { content?: string; tool_calls?: ToolCall[] };
batches?: Array<{ isConcurrencySafe: boolean; tools: ToolCall[] }>;
result?: string;
stopped?: boolean;
stopReason?: string;
iteration?: number;
}

export interface Handler {
name: string;
handle(ctx: PipelineContext, next: () => Promise<void>): Promise<void>;
}

A very simple PipelineRunner:

export class Pipeline {
constructor(private handlers: Handler[]) {}

async run(ctx: PipelineContext) {
let i = -1;
const dispatch = async (idx: number): Promise<void> => {
if (idx <= i) throw new Error('next() called multiple times');
i = idx;
const handler = this.handlers[idx];
if (!handler) return;
await handler.handle(ctx, () => dispatch(idx + 1));
};
await dispatch(0);
}
}


⸻

Example handlers

1) Init & Bootstrap

class InitHandler implements Handler {
name = 'Init';
constructor(
private agentLoader: AgentLoader,
private toolRegistry: ToolRegistry,
private logger: ConversationLogger
) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
const { agentName, prompt, execContext } = ctx;

    this.logger.log({ type: 'system', agentName, depth: execContext.depth,
      content: `Starting execution with ${execContext.parentAgent ? `delegated from ${execContext.parentAgent}` : 'root'}`
    });

    const agent = await this.agentLoader.loadAgent(agentName);
    const tools = this.toolRegistry.filterForAgent(agent);

    const messages: Message[] = [];
    if (execContext.parentMessages?.length) {
      messages.push(...execContext.parentMessages);
      this.logger.log({ type: 'system', agentName, depth: execContext.depth,
        content: `Inheriting ${execContext.parentMessages.length} parent messages`
      });
    }
    messages.push({ role: 'system', content: agent.description },
                  { role: 'user', content: prompt });

    ctx.agent = agent;
    ctx.tools = tools;
    ctx.messages = messages;
    ctx.iteration = 0;

    await next();
}
}

2) Depth Guard

class DepthGuard implements Handler {
name = 'DepthGuard';
constructor(
private logger: ConversationLogger,
private limits: typeof SAFETY_LIMITS
) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
const effectiveMaxDepth = Math.min(ctx.execContext.maxDepth ?? this.limits.MAX_DEPTH, this.limits.MAX_DEPTH);
if (ctx.execContext.depth >= effectiveMaxDepth) {
const msg = `Max delegation depth (${effectiveMaxDepth}) reached. Consider breaking task into smaller parts.`;
this.logger.log({ type: 'system', agentName: ctx.agentName, depth: ctx.execContext.depth, content: `🛑 ${msg}` });
ctx.stopped = true;
ctx.stopReason = msg;
ctx.result = msg;
return;
}
await next();
}
}

3) Iteration Controller (loop-less middleware)

Rather than a big while in one class, wrap the single-step chain and let this handler re-enter it until done:

class IterationController implements Handler {
name = 'IterationController';
constructor(private limits: typeof SAFETY_LIMITS, private logger: ConversationLogger, private step: Pipeline) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
while (!ctx.stopped && (ctx.iteration! < this.limits.MAX_ITERATIONS)) {
ctx.iteration = (ctx.iteration ?? 0) + 1;
if (ctx.iteration === this.limits.WARN_AT_ITERATION) {
console.warn(`⚠️ High iteration count: ${ctx.iteration}`);
}
await this.step.run(ctx);        // runs the “single-iteration” chain
}

    if (ctx.stopped) return;

    if ((ctx.iteration ?? 0) >= this.limits.MAX_ITERATIONS) {
      const msg = `Stopped at ${this.limits.MAX_ITERATIONS} iterations (safety limit). Task may be too complex.`;
      this.logger.log({ type: 'system', agentName: ctx.agentName, depth: ctx.execContext.depth, content: `🛑 ${msg}` });
      ctx.result = msg;
      ctx.stopped = true;
    }
    await next();
}
}

You’ll provide a Step Pipeline made from: TokenGuard -> LLMInvoke -> ToolPlan -> ToolExec -> MessageAccum -> DoneCheck.

4) Token Budget Guard

class TokenBudgetGuard implements Handler {
name = 'TokenBudgetGuard';
constructor(private limits: typeof SAFETY_LIMITS, private logger: ConversationLogger) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
const estimatedTokens = JSON.stringify(ctx.messages).length / 4;
if (estimatedTokens > this.limits.MAX_TOKENS_ESTIMATE) {
const msg = `Task stopped: Token limit estimate exceeded: ~${Math.round(estimatedTokens)} tokens (safety limit)`;
this.logger.log({ type: 'system', agentName: ctx.agentName, depth: ctx.execContext.depth, content: `🛑 ${msg}` });
ctx.result = msg;
ctx.stopped = true;
return;
}
await next();
}
}

5) LLM Invocation

class LLMInvoke implements Handler {
name = 'LLMInvoke';
constructor(private provider: AnthropicProvider, private logger: ConversationLogger) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
this.logger.log({ type: 'system', agentName: ctx.agentName, depth: ctx.execContext.depth,
content: `Calling ${this.provider.getModelName()} (iteration ${ctx.iteration})`,
metadata: { messageCount: ctx.messages.length, toolCount: ctx.tools?.length ?? 0 }
});
const response = await this.provider.complete(ctx.messages, ctx.tools ?? []);
ctx.response = response;

    this.logger.log({ type: 'assistant', agentName: ctx.agentName, depth: ctx.execContext.depth,
      content: response.content || '[No content, tool calls only]',
      metadata: { toolCallCount: response.tool_calls?.length || 0 }
    });

    await next();
}
}

6) Tool Planner

class ToolPlanner implements Handler {
name = 'ToolPlanner';
constructor(private toolRegistry: ToolRegistry, private logger: ConversationLogger) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
const toolCalls = ctx.response?.tool_calls ?? [];
if (!toolCalls.length) return next();

    const groups: Array<{ isConcurrencySafe: boolean; tools: ToolCall[] }> = [];
    for (const tc of toolCalls) {
      const tool = this.toolRegistry.get(tc.function.name);
      const isSafe = tool ? tool.isConcurrencySafe() : false;
      const current = groups[groups.length - 1];
      if (current && current.isConcurrencySafe === isSafe) current.tools.push(tc);
      else groups.push({ isConcurrencySafe: isSafe, tools: [tc] });
    }
    ctx.batches = groups;

    this.logger.log({ type: 'system', agentName: ctx.agentName, depth: ctx.execContext.depth,
      content: `Executing ${toolCalls.length} tools in ${groups.length} group(s)`,
      metadata: { groups: groups.map(g => ({ isConcurrent: g.isConcurrencySafe, size: g.tools.length })) }
    });
    await next();
}
}

7) Tool Executor (with Delegation)

class ToolExecutor implements Handler {
name = 'ToolExecutor';
constructor(
private toolRegistry: ToolRegistry,
private agentExecutorFactory: (modelName?: string) => AgentExecutor, // for delegation reuse
private logger: ConversationLogger
) {}

private async execSingle(tc: ToolCall, ctx: PipelineContext): Promise<Message> {
const tool = this.toolRegistry.get(tc.function.name);
if (!tool) {
const error = `Tool ${tc.function.name} not found`;
this.logger.log({ type: 'error', agentName: ctx.agentName, depth: ctx.execContext.depth, content: error });
return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error }) };
}

    try {
      const args = JSON.parse(tc.function.arguments);

      // Delegation path
      if (tool.name === 'Task') {
        this.logger.log({
          type: 'delegation', agentName: ctx.agentName, depth: ctx.execContext.depth,
          content: `[SIDECHAIN] Delegating to ${args.subagent_type} with full context`,
        });
        const subExec = this.agentExecutorFactory();
        const subResult = await subExec.execute(args.subagent_type, args.prompt, {
          ...ctx.execContext,
          depth: ctx.execContext.depth + 1,
          parentAgent: ctx.agentName,
          isSidechain: true,
          parentMessages: ctx.messages.slice()
        });
        return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ content: subResult }) };
      }

      // Normal tool
      const start = Date.now();
      const res = await tool.execute(args);
      const ms = Date.now() - start;
      this.logger.log({
        type: 'result', agentName: ctx.agentName, depth: ctx.execContext.depth,
        content: `${tool.name} completed in ${ms}ms`,
        metadata: { success: !res.error }
      });
      return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(res) };

    } catch (e) {
      const error = `Tool execution failed: ${e}`;
      this.logger.log({ type: 'error', agentName: ctx.agentName, depth: ctx.execContext.depth, content: error });
      return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error }) };
    }
}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
const batches = ctx.batches ?? [];
if (!batches.length) return next();

    for (const batch of batches) {
      if (batch.isConcurrencySafe) {
        const results = await Promise.all(batch.tools.map(tc => this.execSingle(tc, ctx)));
        ctx.messages.push(ctx.response as any, ...results);
      } else {
        ctx.messages.push(ctx.response as any);
        for (const tc of batch.tools) {
          const r = await this.execSingle(tc, ctx);
          ctx.messages.push(r);
        }
      }
    }
    await next();
}
}

8) Message Accumulator & Done Check

class DoneOrContinue implements Handler {
name = 'DoneOrContinue';
constructor(private logger: ConversationLogger, private provider: AnthropicProvider) {}

async handle(ctx: PipelineContext, next: () => Promise<void>) {
const hadToolCalls = (ctx.response?.tool_calls?.length ?? 0) > 0;

    if (!hadToolCalls) {
      const totalTime = Date.now() - ctx.startTime;
      this.logger.log({
        type: 'result', agentName: ctx.agentName, depth: ctx.execContext.depth,
        content: `Execution completed in ${totalTime}ms`,
        metadata: { iterations: ctx.iteration, model: this.provider.getModelName(), totalMessages: ctx.messages.length }
      });
      ctx.result = ctx.response?.content || 'No response generated';
      ctx.stopped = true;
      return;
    }
    // If tools were called, we’ll loop again (IterationController repeats)
    await next();
}
}

9) Error Boundary (optional wrapper)

Wrap the entire pipeline run with a top-level try/catch handler to set ctx.result and ctx.stopped on failures.

⸻

Wiring the pipelines
•	Step pipeline (one iteration):
TokenBudgetGuard -> LLMInvoke -> ToolPlanner -> ToolExecutor -> DoneOrContinue
•	Outer pipeline:
InitHandler -> DepthGuard -> IterationController(stepPipeline) -> (finalize/flush logger)

This keeps each concern <200 lines and trivially unit-testable.

⸻

Migration plan (low-risk)
1.	Extract ToolPlanner and ToolExecutor first (least invasive).
2.	Move LLM call into LLMInvoke.
3.	Wrap the existing while-loop with IterationController; inside the loop call stepPipeline.run(ctx).
4.	Pull out DepthGuard and TokenBudgetGuard.
5.	Finish with InitHandler and DoneOrContinue.

Each step is safe and testable.

⸻

Extra polish & pitfalls to avoid
•	Immutability: treat ctx.messages as append-only; avoid reordering.
•	Reentrancy: make sure next() isn’t called twice (guard included).
•	Result type: prefer a tiny Result object for tools { ok: boolean; value?: T; error?: string }.
•	Testing: unit-test each handler with a mocked PipelineContext.
•	Observability: keep logging inside handlers so you can enable/disable per concern.
•	Config: inject SAFETY_LIMITS + model name via DI so you can A/B configs.
•	Delegation depth: the DepthGuard should also guard delegation within tools (already handled since Delegation uses same executor).

