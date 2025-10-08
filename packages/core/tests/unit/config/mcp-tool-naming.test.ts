import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'get_current_time',
          description: 'Get the current time',
          inputSchema: {
            type: 'object',
            properties: {
              timezone: { type: 'string' },
            },
            required: [],
          },
        },
        {
          name: 'convert.time',
          description: 'Convert time between zones',
          inputSchema: {
            type: 'object',
            properties: {
              time: { type: 'string' },
              from_tz: { type: 'string' },
              to_tz: { type: 'string' },
            },
            required: ['time'],
          },
        },
      ],
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '12:00 PM' }],
    }),
    close: vi.fn(),
  })),
}));

describe('MCP Tool Naming for Anthropic API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should replace dots with underscores in MCP tool names for Anthropic compatibility', async () => {
    const builder = AgentSystemBuilder.minimal()
      .withMCPServers({
        time: {
          command: 'uvx',
          args: ['mcp-server-time'],
        },
      })
      .withSessionId('test-mcp-naming');

    const { toolRegistry, cleanup } = await builder.build();

    // Check that tool names have been sanitized
    const tools = toolRegistry.getAllTools();
    const mcpTools = tools.filter((t) => t.name.startsWith('time_'));

    // Should have converted dots to underscores
    expect(mcpTools.some((t) => t.name === 'time_get_current_time')).toBe(true);
    expect(mcpTools.some((t) => t.name === 'time_convert_time')).toBe(true);

    // Should NOT have any dots in the names
    expect(mcpTools.some((t) => t.name.includes('.'))).toBe(false);

    // Verify all MCP tool names comply with Anthropic's pattern
    const anthropicPattern = /^[a-zA-Z0-9_-]{1,128}$/;
    mcpTools.forEach((tool) => {
      expect(tool.name).toMatch(anthropicPattern);
    });

    await cleanup();
  });

  it('should handle MCP server names with special characters', async () => {
    // Update the mock to return tools for 'my.server'
    vi.mocked(Client).mockImplementationOnce(
      () =>
        ({
          connect: vi.fn().mockResolvedValue(undefined),
          listTools: vi.fn().mockResolvedValue({
            tools: [
              {
                name: 'test_tool',
                description: 'Test tool',
                inputSchema: { type: 'object', properties: {}, required: [] },
              },
            ],
          }),
          callTool: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'test' }],
          }),
          close: vi.fn(),
        }) as any
    );

    const builder = AgentSystemBuilder.minimal()
      .withMCPServers({
        'my.server': {
          command: 'test',
          args: [],
        },
      })
      .withSessionId('test-server-naming');

    const { toolRegistry, cleanup } = await builder.build();

    const tools = toolRegistry.getAllTools();
    const mcpTools = tools.filter((t) => t.name.startsWith('my_server_'));

    // Server name dots should also be replaced
    expect(mcpTools.length).toBeGreaterThan(0);
    mcpTools.forEach((tool) => {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
      expect(tool.name).not.toContain('.');
    });

    await cleanup();
  });
});
