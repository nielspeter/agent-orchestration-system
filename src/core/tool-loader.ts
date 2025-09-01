import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool, ToolResult } from '../types';
import { ConversationLogger } from './conversation-logger';
import { createShellTool } from '../tools/shell-tool';

/**
 * Tool metadata extracted from script files
 */
interface ToolMetadata {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  returns?: string;
}

/**
 * ToolLoader - Loads script files as tools
 * 
 * Similar to AgentLoader, this class loads tool definitions from script files.
 * It parses metadata from script headers and creates BaseTool wrappers that
 * execute the scripts via the shell tool.
 * 
 * Supported formats:
 * - Python (.py) with docstring metadata
 * - JavaScript (.js) with JSDoc comments
 * - Shell scripts (.sh) with comment metadata
 */
export class ToolLoader {
  private shellTool: BaseTool;

  constructor(
    private readonly toolsDir: string,
    private readonly logger?: ConversationLogger
  ) {
    this.shellTool = createShellTool();
  }

  /**
   * Load a tool from a script file
   */
  async loadTool(name: string): Promise<BaseTool> {
    // Try different extensions
    const extensions = ['.py', '.js', '.sh'];
    let scriptPath: string | null = null;
    let scriptContent: string | null = null;

    for (const ext of extensions) {
      const fullPath = path.join(this.toolsDir, name + ext);
      try {
        scriptContent = await fs.readFile(fullPath, 'utf-8');
        scriptPath = fullPath;
        break;
      } catch {
        // Try next extension
      }
    }

    if (!scriptPath || !scriptContent) {
      throw new Error(`Tool script not found: ${name} in ${this.toolsDir}`);
    }

    // Parse metadata from script
    const metadata = this.parseMetadata(scriptContent, path.extname(scriptPath));

    // Use provided name or fallback to filename
    const toolName = metadata.name || name;

    this.logger?.log({
      timestamp: new Date().toISOString(),
      agentName: 'system',
      depth: 0,
      type: 'system',
      content: `Loaded tool script: ${toolName} from ${scriptPath}`,
    });

    // Create a tool that executes the script
    return this.createScriptTool(toolName, scriptPath, metadata);
  }

  /**
   * List all available tool scripts
   */
  async listTools(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.toolsDir);
      const tools = files
        .filter((f) => f.endsWith('.py') || f.endsWith('.js') || f.endsWith('.sh'))
        .map((f) => f.replace(/\.(py|js|sh)$/, ''));
      
      return [...new Set(tools)]; // Remove duplicates if same name with different extensions
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse metadata from script content based on file type
   */
  private parseMetadata(content: string, extension: string): ToolMetadata {
    switch (extension) {
      case '.py':
        return this.parsePythonMetadata(content);
      case '.js':
        return this.parseJavaScriptMetadata(content);
      case '.sh':
        return this.parseShellMetadata(content);
      default:
        return { name: '' };
    }
  }

  /**
   * Parse Python docstring metadata
   * Format:
   * """
   * name: tool_name
   * description: Tool description
   * parameters:
   *   param1: string
   *   param2: number
   * """
   */
  private parsePythonMetadata(content: string): ToolMetadata {
    const metadata: ToolMetadata = { name: '' };
    
    // Look for docstring at the beginning (after shebang)
    const docstringMatch = content.match(/^(?:#!.*\n)?"""([\s\S]*?)"""/);
    if (!docstringMatch) {
      return metadata;
    }

    const docstring = docstringMatch[1];
    
    // Parse simple key: value pairs
    const nameMatch = docstring.match(/name:\s*(.+)/);
    if (nameMatch) metadata.name = nameMatch[1].trim();
    
    const descMatch = docstring.match(/description:\s*(.+)/);
    if (descMatch) metadata.description = descMatch[1].trim();
    
    // Parse parameters (simplified - could be enhanced)
    const paramsMatch = docstring.match(/parameters:\s*\n((?:\s+.+\n)*)/);
    if (paramsMatch) {
      metadata.parameters = {};
      const paramLines = paramsMatch[1].split('\n').filter(line => line.trim());
      for (const line of paramLines) {
        const [key, type] = line.trim().split(':').map(s => s.trim());
        if (key && type) {
          metadata.parameters[key] = { type, description: `Parameter ${key}` };
        }
      }
    }

    return metadata;
  }

  /**
   * Parse JavaScript JSDoc metadata
   */
  private parseJavaScriptMetadata(content: string): ToolMetadata {
    const metadata: ToolMetadata = { name: '' };
    
    // Look for JSDoc comment at the beginning
    const jsdocMatch = content.match(/^(?:#!.*\n)?\/\*\*([\s\S]*?)\*\//);
    if (!jsdocMatch) {
      return metadata;
    }

    const jsdoc = jsdocMatch[1];
    
    // Parse @tool and @description tags
    const nameMatch = jsdoc.match(/@tool\s+(\S+)/);
    if (nameMatch) metadata.name = nameMatch[1];
    
    const descMatch = jsdoc.match(/@description\s+(.+)/);
    if (descMatch) metadata.description = descMatch[1].trim();
    
    // Parse @param tags
    const paramMatches = jsdoc.matchAll(/@param\s+\{(\w+)\}\s+(\w+)(?:\s+-\s+(.+))?/g);
    metadata.parameters = {};
    for (const match of paramMatches) {
      const [, type, name, description] = match;
      metadata.parameters[name] = { type, description: description || `Parameter ${name}` };
    }

    return metadata;
  }

  /**
   * Parse shell script comment metadata
   */
  private parseShellMetadata(content: string): ToolMetadata {
    const metadata: ToolMetadata = { name: '' };
    
    // Look for comments at the beginning
    const lines = content.split('\n');
    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      if (line.startsWith('# Tool:')) {
        metadata.name = line.substring(7).trim();
      } else if (line.startsWith('# Description:')) {
        metadata.description = line.substring(14).trim();
      } else if (!line.startsWith('#')) {
        break; // Stop at first non-comment line
      }
    }

    return metadata;
  }

  /**
   * Create a BaseTool that executes a script
   */
  private createScriptTool(name: string, scriptPath: string, metadata: ToolMetadata): BaseTool {
    // Build parameter schema from metadata
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (metadata.parameters) {
      for (const [paramName, paramInfo] of Object.entries(metadata.parameters)) {
        properties[paramName] = {
          type: paramInfo.type || 'string',
          description: paramInfo.description || `Parameter ${paramName}`,
        };
        // For now, assume all parameters are required unless specified
        if (paramInfo.required !== false) {
          required.push(paramName);
        }
      }
    }

    return {
      name,
      description: metadata.description || `Execute ${name} script`,
      parameters: {
        type: 'object' as const,
        properties,
        required,
      },

      execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
        // Determine how to run the script based on extension
        const ext = path.extname(scriptPath);
        let command: string;

        // Build command based on script type
        if (ext === '.py') {
          // Pass arguments as JSON via stdin for Python
          const jsonArgs = JSON.stringify(args);
          command = `echo '${jsonArgs.replace(/'/g, "'\\''")}' | python3 "${scriptPath}"`;
        } else if (ext === '.js') {
          // Pass arguments as command line args for Node
          const argsStr = Object.entries(args)
            .map(([key, value]) => `--${key}="${value}"`)
            .join(' ');
          command = `node "${scriptPath}" ${argsStr}`;
        } else if (ext === '.sh') {
          // Pass arguments as environment variables for shell
          const envVars = Object.entries(args)
            .map(([key, value]) => `${key.toUpperCase()}="${value}"`)
            .join(' ');
          command = `${envVars} bash "${scriptPath}"`;
        } else {
          // Default: just run the script
          command = `"${scriptPath}"`;
        }

        // Execute via shell tool
        const result = await this.shellTool.execute({
          command,
          timeout: 30000,
          parseJson: true, // Try to parse output as JSON
        });

        return result;
      },

      isConcurrencySafe: () => true, // Scripts can generally run in parallel
    };
  }
}