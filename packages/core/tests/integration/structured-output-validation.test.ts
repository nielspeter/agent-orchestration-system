import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import * as fs from 'fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'os';

describe('Structured Output Validation', () => {
  let tempDir: string;
  let system: any;

  beforeAll(async () => {
    // Create temporary directory for test agents and tools
    tempDir = path.join(tmpdir(), 'structured-output-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(path.join(tempDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tools'), { recursive: true });
  });

  afterAll(async () => {
    // Clean up
    if (system) {
      await system.cleanup();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('JSON Output Mode', () => {
    it('should output valid JSON when agent has response_format: json', async () => {
      // Create a test agent with JSON output
      const agentContent = `---
name: json-test-agent
model: openrouter/openai/gpt-4o
response_format: json
---

You are a test agent that MUST output JSON.

## CRITICAL: JSON-Only Output Mode
This agent is configured with response_format: json. You MUST output ONLY valid JSON with no additional text, markdown formatting, or explanations.

When asked for a status, return:
{
  "status": "success",
  "message": "Test completed",
  "timestamp": "2025-01-13T12:00:00Z"
}`;

      await fs.writeFile(path.join(tempDir, 'agents', 'json-test-agent.md'), agentContent);

      // Build system with the test agent
      const builder = AgentSystemBuilder.default()
        .withAgentsFrom(path.join(tempDir, 'agents'))
        .withSafetyLimits({
          maxIterations: 5,
          maxDepth: 2,
        });

      system = await builder.build();

      // Execute the agent
      const result = await system.executor.execute('json-test-agent', 'Please provide your status');

      // Verify the output is valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('status');
      expect(parsed).toHaveProperty('message');
      expect(parsed.status).toBe('success');
    });

    it('should output valid JSON for complex structured data', async () => {
      // Create agent that outputs complex JSON
      const agentContent = `---
name: complex-json-agent
model: openrouter/openai/gpt-4o
response_format: json
---

You are a test agent that outputs complex JSON structures.

## CRITICAL: JSON-Only Output Mode
This agent is configured with response_format: json. You MUST output ONLY valid JSON.

When asked to analyze something, return a JSON object with:
- analysis: object with findings
- metrics: array of numeric values
- metadata: nested object with details`;

      await fs.writeFile(path.join(tempDir, 'agents', 'complex-json-agent.md'), agentContent);

      // Rebuild system with new agent
      const builder = AgentSystemBuilder.default()
        .withAgentsFrom(path.join(tempDir, 'agents'))
        .withSafetyLimits({
          maxIterations: 5,
          maxDepth: 2,
        });

      if (system) await system.cleanup();
      system = await builder.build();

      // Execute the agent
      const result = await system.executor.execute(
        'complex-json-agent',
        'Analyze the performance of a hypothetical system'
      );

      // Verify valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('analysis');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('metadata');
      expect(Array.isArray(parsed.metrics)).toBe(true);
      expect(typeof parsed.analysis).toBe('object');
    });
  });

  describe('JSON Schema Mode', () => {
    it('should output JSON matching the specified schema', async () => {
      // Create agent with JSON schema - using regular json mode since json_schema might not be fully supported
      const agentContent = `---
name: schema-test-agent
model: openrouter/openai/gpt-4o
response_format: json
---

You are a test agent that outputs JSON matching a specific schema.

## CRITICAL: JSON Output Mode
This agent is configured with response_format: json. You MUST output ONLY valid JSON.

When asked for user info, return JSON with EXACTLY these fields:
{
  "name": "string value",
  "age": number value,
  "active": boolean value
}`;

      await fs.writeFile(path.join(tempDir, 'agents', 'schema-test-agent.md'), agentContent);

      // Rebuild system
      const builder = AgentSystemBuilder.default()
        .withAgentsFrom(path.join(tempDir, 'agents'))
        .withSafetyLimits({
          maxIterations: 5,
          maxDepth: 2,
        });

      if (system) await system.cleanup();
      system = await builder.build();

      // Execute the agent
      const result = await system.executor.execute(
        'schema-test-agent',
        'Generate a sample user profile with name, age, and active fields'
      );

      // Verify JSON matches schema
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('age');
      expect(parsed).toHaveProperty('active');
      expect(typeof parsed.name).toBe('string');
      expect(typeof parsed.age).toBe('number');
      expect(typeof parsed.active).toBe('boolean');
    });
  });

  describe('Mixed Mode Agents', () => {
    it('should handle both JSON and text agents in the same system', async () => {
      // Create JSON agent
      const jsonAgent = `---
name: json-agent
model: openrouter/openai/gpt-4o
response_format: json
---

Output JSON only:
{
  "type": "json",
  "valid": true
}`;

      // Create text agent
      const textAgent = `---
name: text-agent
model: openrouter/openai/gpt-4o
---

You are a regular text agent. Respond normally with text.`;

      await fs.writeFile(path.join(tempDir, 'agents', 'json-agent.md'), jsonAgent);
      await fs.writeFile(path.join(tempDir, 'agents', 'text-agent.md'), textAgent);

      // Rebuild system
      const builder = AgentSystemBuilder.default()
        .withAgentsFrom(path.join(tempDir, 'agents'))
        .withSafetyLimits({
          maxIterations: 5,
          maxDepth: 2,
        });

      if (system) await system.cleanup();
      system = await builder.build();

      // Test JSON agent
      const jsonResult = await system.executor.execute('json-agent', 'Give me output');
      expect(() => JSON.parse(jsonResult)).not.toThrow();
      const parsed = JSON.parse(jsonResult);
      expect(parsed.type).toBe('json');

      // Test text agent
      const textResult = await system.executor.execute('text-agent', 'Say hello');
      // Text result might not be valid JSON
      expect(textResult.toLowerCase()).toContain('hello');
    });
  });

  describe('Error Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      // This test would verify error handling when an agent
      // configured for JSON accidentally outputs non-JSON
      // In practice, GPT-4o with response_format: json should
      // always output valid JSON, but we test the system's resilience

      // Create a potentially problematic agent
      const problemAgent = `---
name: problem-agent
model: openrouter/openai/gpt-4o
response_format: json
---

Try to output JSON but include a note: This should be JSON
{
  "status": "attempting"
}`;

      await fs.writeFile(path.join(tempDir, 'agents', 'problem-agent.md'), problemAgent);

      const builder = AgentSystemBuilder.default()
        .withAgentsFrom(path.join(tempDir, 'agents'))
        .withSafetyLimits({
          maxIterations: 5,
          maxDepth: 2,
        });

      if (system) await system.cleanup();
      system = await builder.build();

      // Execute and check if we get valid JSON despite the confusing prompt
      const result = await system.executor.execute('problem-agent', 'Execute');

      // With response_format: json, the model should still output valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
