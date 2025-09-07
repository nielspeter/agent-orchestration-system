import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolLoader } from '@/tools/registry/loader';
import { createShellTool } from '@/tools/shell.tool';

describe('ToolLoader', () => {
  const testDir = 'test-tools-temp';

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('listTools', () => {
    it('should list Python, JavaScript and Shell scripts', async () => {
      // Create test scripts
      await fs.writeFile(
        path.join(testDir, 'tool1.py'),
        '#!/usr/bin/env python3\n"""name: tool1"""'
      );
      await fs.writeFile(path.join(testDir, 'tool2.js'), '#!/usr/bin/env node\n/** @tool tool2 */');
      await fs.writeFile(path.join(testDir, 'tool3.sh'), '#!/bin/bash\n# Tool: tool3');
      await fs.writeFile(path.join(testDir, 'readme.md'), '# Not a tool');

      const loader = new ToolLoader(testDir);
      const tools = await loader.listTools();

      expect(tools).toHaveLength(3);
      expect(tools).toContain('tool1');
      expect(tools).toContain('tool2');
      expect(tools).toContain('tool3');
    });

    it('should return empty array for non-existent directory', async () => {
      const loader = new ToolLoader('non-existent-dir');
      const tools = await loader.listTools();
      expect(tools).toEqual([]);
    });

    it('should handle duplicate names with different extensions', async () => {
      await fs.writeFile(path.join(testDir, 'mytool.py'), '#!/usr/bin/env python3');
      await fs.writeFile(path.join(testDir, 'mytool.js'), '#!/usr/bin/env node');

      const loader = new ToolLoader(testDir);
      const tools = await loader.listTools();

      expect(tools).toHaveLength(1);
      expect(tools).toContain('mytool');
    });
  });

  describe('loadTool', () => {
    it('should load and parse Python tool metadata', async () => {
      const pythonScript = `#!/usr/bin/env python3
"""
name: word_counter
description: Count words in text
parameters:
  text: string
  uppercase: boolean
"""
import sys
print("test")`;

      await fs.writeFile(path.join(testDir, 'word_counter.py'), pythonScript);

      const loader = new ToolLoader(testDir);
      const tool = await loader.loadTool('word_counter');

      expect(tool.name).toBe('word_counter');
      expect(tool.description).toBe('Count words in text');
      expect(tool.parameters.properties).toHaveProperty('text');
      expect(tool.parameters.properties).toHaveProperty('uppercase');
      expect(tool.parameters.required).toContain('text');
      expect(tool.parameters.required).toContain('uppercase');
    });

    it('should load and parse JavaScript tool metadata', async () => {
      const jsScript = `#!/usr/bin/env node
/**
 * @tool calculator
 * @description Perform calculations
 * @param {number} a - First number
 * @param {number} b - Second number
 */
console.log("test");`;

      await fs.writeFile(path.join(testDir, 'calculator.js'), jsScript);

      const loader = new ToolLoader(testDir);
      const tool = await loader.loadTool('calculator');

      expect(tool.name).toBe('calculator');
      expect(tool.description).toBe('Perform calculations');
      expect(tool.parameters.properties).toHaveProperty('a');
      expect(tool.parameters.properties).toHaveProperty('b');
      expect(tool.parameters.properties.a.type).toBe('number');
      expect(tool.parameters.properties.b.type).toBe('number');
    });

    it('should load and parse Shell tool metadata', async () => {
      const shScript = `#!/bin/bash
# Tool: system_info
# Description: Get system information
echo "test"`;

      await fs.writeFile(path.join(testDir, 'system_info.sh'), shScript);

      const loader = new ToolLoader(testDir);
      const tool = await loader.loadTool('system_info');

      expect(tool.name).toBe('system_info');
      expect(tool.description).toBe('Get system information');
    });

    it('should use filename as fallback name', async () => {
      const script = `#!/usr/bin/env python3
# No metadata
print("test")`;

      await fs.writeFile(path.join(testDir, 'my_tool.py'), script);

      const loader = new ToolLoader(testDir);
      const tool = await loader.loadTool('my_tool');

      expect(tool.name).toBe('my_tool');
      expect(tool.description).toBe('Execute my_tool script');
    });

    it('should throw error for non-existent tool', async () => {
      const loader = new ToolLoader(testDir);
      await expect(loader.loadTool('non_existent')).rejects.toThrow(
        'Tool script not found: non_existent'
      );
    });
  });

  describe('tool execution', () => {
    it('should execute Python script with JSON input/output', async () => {
      const pythonScript = `#!/usr/bin/env python3
"""
name: echo_tool
description: Echo input
parameters:
  message: string
"""
import sys
import json
data = json.load(sys.stdin)
print(json.dumps({"echo": data.get("message", "")}))`;

      await fs.writeFile(path.join(testDir, 'echo_tool.py'), pythonScript);

      const loader = new ToolLoader(testDir);
      const tool = await loader.loadTool('echo_tool');
      const result = await tool.execute({ message: 'Hello' });

      expect(result.content).toEqual({ echo: 'Hello' });
      expect(result.error).toBeUndefined();
    });

    it('should handle tool execution errors', async () => {
      const pythonScript = `#!/usr/bin/env python3
"""
name: error_tool
description: Tool that errors
"""
import sys
sys.exit(1)`;

      await fs.writeFile(path.join(testDir, 'error_tool.py'), pythonScript);

      const loader = new ToolLoader(testDir);
      const tool = await loader.loadTool('error_tool');
      const result = await tool.execute({});

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Exit code: 1');
    });
  });
});

describe('ShellTool', () => {
  it('should execute simple commands', async () => {
    const tool = createShellTool();
    const result = await tool.execute({ command: 'echo "Hello World"' });

    expect(result.content).toBe('Hello World');
    expect(result.error).toBeUndefined();
  });

  it('should handle command with JSON output', async () => {
    const tool = createShellTool();
    const result = await tool.execute({
      command: 'echo \'{"key": "value"}\'',
      parseJson: true,
    });

    expect(result.content).toEqual({ key: 'value' });
    expect(result.error).toBeUndefined();
  });

  it('should handle command timeout', async () => {
    const tool = createShellTool();
    const result = await tool.execute({
      command: 'sleep 5',
      timeout: 100, // 100ms timeout
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain('timed out');
  });

  it('should handle command errors', async () => {
    const tool = createShellTool();
    const result = await tool.execute({
      command: 'exit 1',
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Exit code: 1');
  });

  it('should capture stderr', async () => {
    const tool = createShellTool();
    const result = await tool.execute({
      command: 'echo "error" >&2 && echo "output"',
    });

    expect(result.content).toBe('output');
    expect(result.error).toContain('stderr: error');
  });

  it('should work with different working directories', async () => {
    const tool = createShellTool();
    const result = await tool.execute({
      command: 'pwd',
      cwd: '/tmp',
    });

    // On macOS, /tmp is a symlink to /private/tmp
    expect(result.content).toMatch(/\/(private\/)?tmp/);
    expect(result.error).toBeUndefined();
  });
});
