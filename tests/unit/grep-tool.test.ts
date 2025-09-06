import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createGrepTool } from '@/tools/grep-tool';
import { execSync } from 'child_process';

// Mock execSync
vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

describe('Grep Tool - Essential Tests', () => {
  let grepTool: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    grepTool = createGrepTool();
  });

  test('has correct metadata', () => {
    expect(grepTool.name).toBe('grep');
    expect(grepTool.description).toContain('Search for text patterns');
  });

  test('validates required pattern parameter', async () => {
    const result = await grepTool.execute({});
    // When pattern is missing, it should return an error
    expect(result.content).toBeNull();
    expect(result.error).toBeDefined();
  });

  test('executes basic pattern search', async () => {
    const mockOutput = 'file1.ts:10:const test = "hello"\nfile2.ts:20:function test() {}';
    (execSync as any).mockReturnValue(mockOutput);
    
    const result = await grepTool.execute({ pattern: 'test' });
    
    expect(result.content).toBeDefined();
    expect(result.content).toContain('file1.ts:10');
    expect(result.content).toContain('file2.ts:20');
    expect(result.error).toBeUndefined();
  });

  test('handles no matches gracefully', async () => {
    // Mock execSync to throw (ripgrep returns exit code 1 for no matches)
    (execSync as any).mockImplementation(() => {
      const error: any = new Error('No matches');
      error.status = 1;
      throw error;
    });
    
    const result = await grepTool.execute({ pattern: 'nonexistent-pattern-xyz' });
    
    expect(result.content).toBe('No matches found');
    expect(result.error).toBeUndefined();
  });

  test('applies path filter correctly', async () => {
    const mockOutput = 'src/test.ts:1:match';
    (execSync as any).mockReturnValue(mockOutput);
    
    const result = await grepTool.execute({ 
      pattern: 'test',
      path: 'src'
    });
    
    expect(result.content).toBeDefined();
    expect(execSync).toHaveBeenCalled();
    const commandCall = (execSync as any).mock.calls[0][0];
    expect(commandCall).toContain('"src"');
  });

  test('handles real errors properly', async () => {
    (execSync as any).mockImplementation(() => {
      throw new Error('Command not found: rg');
    });
    
    const result = await grepTool.execute({ pattern: 'test' });
    
    expect(result.content).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Search failed');
  });

  test('builds command with correct flags', async () => {
    (execSync as any).mockReturnValue('');
    
    await grepTool.execute({ 
      pattern: 'test.*pattern',
      path: 'src'
    });
    
    expect(execSync).toHaveBeenCalled();
    const commandCall = (execSync as any).mock.calls[0][0];
    expect(commandCall).toContain('rg');
    expect(commandCall).toContain('-n'); // line numbers
    expect(commandCall).toContain('-H'); // filenames
    expect(commandCall).toContain('--no-heading');
    expect(commandCall).toContain('"test.*pattern"');
    expect(commandCall).toContain('"src"');
  });

  test('escapes quotes in pattern', async () => {
    (execSync as any).mockReturnValue('');
    
    await grepTool.execute({ 
      pattern: 'test"pattern'
    });
    
    expect(execSync).toHaveBeenCalled();
    const commandCall = (execSync as any).mock.calls[0][0];
    // Pattern should have escaped quotes - the command builder escapes quotes
    expect(commandCall).toContain('test\\"pattern');
  });
});