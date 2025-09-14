import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool, ToolParameter, ToolResult } from '@/base-types';
import { AgentLogger } from '@/logging';
import { createShellTool } from '@/tools/shell.tool';

/**
 * Tool metadata extracted from script files
 */
interface ToolMetadata {
  name: string;
  description?: string;
  parameters?: Record<
    string,
    {
      type: string;
      description?: string;
      required?: boolean;
    }
  >;
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
  private readonly shellTool: BaseTool;

  constructor(
    private readonly toolsDir: string,
    private readonly logger?: AgentLogger
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

    this.logger?.logSystemMessage(`Loaded tool script: ${toolName} from ${scriptPath}`);

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
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;
      if (fileError.code === 'ENOENT') {
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
    const docstringMatch = RegExp(/^(?:#!.*\n)?"""([\s\S]*?)"""/).exec(content);
    if (!docstringMatch) {
      return metadata;
    }

    const docstring = docstringMatch[1];

    // Parse simple key: value pairs
    const nameMatch = RegExp(/name:\s*(.+)/).exec(docstring);
    if (nameMatch) metadata.name = nameMatch[1].trim();

    const descMatch = RegExp(/description:\s*(.+)/).exec(docstring);
    if (descMatch) metadata.description = descMatch[1].trim();

    // Parse parameters (simplified - could be enhanced)
    const paramsMatch = RegExp(/parameters:\s*\n((?:\s+.+\n)*)/).exec(docstring);
    if (paramsMatch) {
      metadata.parameters = {};
      const paramLines = paramsMatch[1].split('\n').filter((line) => line.trim());
      for (const line of paramLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        let key = line.substring(0, colonIndex).trim();
        const rest = line.substring(colonIndex + 1).trim();

        // Check if parameter is optional (ends with ?)
        let required = true;
        if (key.endsWith('?')) {
          key = key.slice(0, -1).trim();
          required = false;
        }

        // Parse type and optional description
        // Format: "type" or "type - description"
        // Type can be: "string", "array", "array<string>", "object", etc.
        const dashIndex = rest.indexOf(' - ');
        let type: string;
        let description: string;

        if (dashIndex !== -1) {
          type = rest.substring(0, dashIndex).trim();
          description = rest.substring(dashIndex + 3).trim();
        } else {
          // Just type, no description
          type = rest.trim();
          description = `Parameter ${key}`;
        }

        // Normalize array types: "array<string>" -> "array"
        // (item type will be handled in createScriptTool)
        if (type.startsWith('array')) {
          type = 'array';
        }

        if (key && type) {
          metadata.parameters[key] = { type, description, required };
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
    const jsdocMatch = RegExp(/^(?:#!.*\n)?\/\*\*([\s\S]*?)\*\//).exec(content);
    if (!jsdocMatch) {
      return metadata;
    }

    const jsdoc = jsdocMatch[1];

    // Parse @tool and @description tags
    const nameMatch = RegExp(/@tool\s+(\S+)/).exec(jsdoc);
    if (nameMatch) metadata.name = nameMatch[1];

    const descMatch = RegExp(/@description\s+(.+)/).exec(jsdoc);
    if (descMatch) metadata.description = descMatch[1].trim();

    // Parse @param tags
    const paramMatches = jsdoc.matchAll(/@param\s+\{(\w+)}\s+(\w+)(?:\s+-\s+(.+))?/g);
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
    for (const line of lines.slice(0, 10)) {
      // Check first 10 lines
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
    const properties: Record<string, ToolParameter> = {};
    const required: string[] = [];

    if (metadata.parameters) {
      for (const [paramName, paramInfo] of Object.entries(metadata.parameters)) {
        // Handle different parameter types
        const paramType = paramInfo.type || 'string';

        if (paramType === 'array') {
          // For arrays, create proper JSON schema with items
          properties[paramName] = {
            type: 'array',
            description: paramInfo.description || `Parameter ${paramName}`,
            items: {
              type: 'string',
              description: 'Array item',
            } as ToolParameter, // Default to string items
          };
        } else if (paramType === 'object') {
          // For objects, create proper JSON schema
          properties[paramName] = {
            type: 'object',
            description: paramInfo.description || `Parameter ${paramName}`,
            // Note: additionalProperties not supported in ToolParameter interface
            // Objects will need to define their properties explicitly
          };
        } else {
          // Simple types (string, number, boolean)
          properties[paramName] = {
            type: paramType,
            description: paramInfo.description || `Parameter ${paramName}`,
          };
        }

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
        // Pass JSON via stdin for all script types (most flexible)
        const jsonArgs = JSON.stringify(args);

        if (ext === '.py') {
          command = `echo '${jsonArgs.replace(/'/g, "'\\''")}' | python3 "${scriptPath}"`;
        } else if (ext === '.js') {
          // Also pass via stdin for Node.js scripts
          command = `echo '${jsonArgs.replace(/'/g, "'\\''")}' | node "${scriptPath}"`;
        } else if (ext === '.sh') {
          // For shell scripts, pass as environment variables (they typically don't read stdin)
          const envVars = Object.entries(args)
            .map(([key, value]) => `${key.toUpperCase()}="${value}"`)
            .join(' ');
          command = `${envVars} bash "${scriptPath}"`;
        } else {
          // Default: pass JSON via stdin
          command = `echo '${jsonArgs.replace(/'/g, "'\\''")}' | "${scriptPath}"`;
        }

        // Execute via shell tool
        const result = await this.shellTool.execute({
          command,
          timeout: 30000,
          parseJson: true, // Try to parse output as JSON
        });

        // Check if the tool returned a success/error response
        if (result.content && typeof result.content === 'object') {
          const toolResponse = result.content as { success?: boolean; error?: string };

          // If tool explicitly returned success: false, convert to error
          if (toolResponse.success === false) {
            return {
              content: '',
              error: toolResponse.error || 'Tool execution failed',
            };
          }
        }

        return result;
      },

      isConcurrencySafe: () => true, // Scripts can generally run in parallel
    };
  }
}
