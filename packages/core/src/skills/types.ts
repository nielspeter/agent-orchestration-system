/**
 * Skills Types
 *
 * Type definitions for the Skills system following Anthropic's Agent Skills Spec v1.0.
 * Skills are domain expertise packages that agents can load for specialized tasks.
 *
 * @see https://docs.anthropic.com (Agent Skills Spec v1.0, 2025-10-16)
 */

/**
 * Skill Frontmatter (YAML)
 *
 * Parsed from the frontmatter section of SKILL.md files.
 * Follows Anthropic's Agent Skills Spec v1.0.
 */
export interface SkillFrontmatter {
  /**
   * Unique skill identifier (hyphen-case, matches directory name)
   * @example "danish-tender-guidelines"
   */
  name: string;

  /**
   * When Claude should use this skill
   * @example "Danish public tender (offentlig udbud) compliance rules and formatting"
   */
  description: string;

  /**
   * Optional: License identifier or filename
   * @example "MIT" or "LICENSE.txt"
   */
  license?: string;

  /**
   * Optional: Pre-approved tools for Claude Code (array of tool names)
   * @example ["read", "write", "grep"]
   */
  'allowed-tools'?: string[];

  /**
   * Optional: Free-form key-value pairs for custom properties
   * Common properties: version, author, tags
   * @example { version: "1.0.0", author: "Your Name", tags: "tender,danish" }
   */
  metadata?: Record<string, string>;
}

/**
 * Resource loader function type
 */
export type ResourceLoader = (filename: string) => Promise<string>;

/**
 * Skill
 *
 * Complete skill definition with lazy-loaded resources.
 * Resources (reference/, assets/, scripts/) are loaded on-demand to optimize memory.
 */
export class Skill {
  /**
   * Unique skill identifier (hyphen-case, matches directory name)
   */
  readonly name: string;

  /**
   * When Claude should use this skill
   */
  readonly description: string;

  /**
   * Optional: License identifier or filename
   */
  readonly license?: string;

  /**
   * Optional: Pre-approved tools for Claude Code
   */
  readonly allowedTools?: string[];

  /**
   * Optional: Free-form key-value pairs for custom properties
   */
  readonly metadata?: Record<string, string>;

  /**
   * Main instructions (markdown content from SKILL.md body)
   * This is the core skill knowledge that gets injected into agent prompts.
   */
  readonly instructions: string;

  /**
   * Internal: Filesystem path to skill directory
   * Used for logging and debugging.
   */
  readonly path: string;

  // Private fields for lazy loading
  private readonly _referenceFiles: string[];
  private readonly _scriptFiles: string[];
  private readonly _assetFiles: string[];
  private readonly _referenceCache = new Map<string, string>();
  private readonly _scriptCache = new Map<string, string>();
  private readonly _assetCache = new Map<string, string>();
  private readonly _loadResource: ResourceLoader;

  constructor(config: {
    name: string;
    description: string;
    license?: string;
    allowedTools?: string[];
    metadata?: Record<string, string>;
    instructions: string;
    path: string;
    referenceFiles?: string[];
    scriptFiles?: string[];
    assetFiles?: string[];
    loadResource: ResourceLoader;
  }) {
    this.name = config.name;
    this.description = config.description;
    this.license = config.license;
    this.allowedTools = config.allowedTools;
    this.metadata = config.metadata;
    this.instructions = config.instructions;
    this.path = config.path;
    this._referenceFiles = config.referenceFiles || [];
    this._scriptFiles = config.scriptFiles || [];
    this._assetFiles = config.assetFiles || [];
    this._loadResource = config.loadResource;
  }

  /**
   * List available reference documentation files
   */
  listReferences(): string[] {
    return [...this._referenceFiles];
  }

  /**
   * List available script files
   */
  listScripts(): string[] {
    return [...this._scriptFiles];
  }

  /**
   * List available asset files
   */
  listAssets(): string[] {
    return [...this._assetFiles];
  }

  /**
   * Get a reference document by filename (lazy loaded and cached)
   * @param filename - Name of the reference file
   * @returns File content or undefined if not found
   */
  async getReference(filename: string): Promise<string | undefined> {
    if (!this._referenceFiles.includes(filename)) {
      return undefined;
    }
    if (!this._referenceCache.has(filename)) {
      const content = await this._loadResource(`reference/${filename}`);
      this._referenceCache.set(filename, content);
    }
    return this._referenceCache.get(filename);
  }

  /**
   * Get a script by filename (lazy loaded and cached)
   * @param filename - Name of the script file
   * @returns File content or undefined if not found
   */
  async getScript(filename: string): Promise<string | undefined> {
    if (!this._scriptFiles.includes(filename)) {
      return undefined;
    }
    if (!this._scriptCache.has(filename)) {
      const content = await this._loadResource(`scripts/${filename}`);
      this._scriptCache.set(filename, content);
    }
    return this._scriptCache.get(filename);
  }

  /**
   * Get an asset by filename (lazy loaded and cached)
   * @param filename - Name of the asset file
   * @returns File content or undefined if not found
   */
  async getAsset(filename: string): Promise<string | undefined> {
    if (!this._assetFiles.includes(filename)) {
      return undefined;
    }
    if (!this._assetCache.has(filename)) {
      const content = await this._loadResource(`assets/${filename}`);
      this._assetCache.set(filename, content);
    }
    return this._assetCache.get(filename);
  }

  /**
   * Load all reference files at once
   * @returns Record of filename to content
   */
  async loadAllReferences(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const filename of this._referenceFiles) {
      const content = await this.getReference(filename);
      if (content !== undefined) {
        result[filename] = content;
      }
    }
    return result;
  }

  /**
   * Load all script files at once
   * @returns Record of filename to content
   */
  async loadAllScripts(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const filename of this._scriptFiles) {
      const content = await this.getScript(filename);
      if (content !== undefined) {
        result[filename] = content;
      }
    }
    return result;
  }

  /**
   * Load all asset files at once
   * @returns Record of filename to content
   */
  async loadAllAssets(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const filename of this._assetFiles) {
      const content = await this.getAsset(filename);
      if (content !== undefined) {
        result[filename] = content;
      }
    }
    return result;
  }
}

/**
 * Skill Configuration in Agent Frontmatter
 *
 * Extended agent interface to support skills.
 * Agents reference skills by name in their frontmatter.
 */
export interface AgentSkillConfig {
  /**
   * Array of skill names to load for this agent
   * Skills are loaded when agent is instantiated.
   * @example ["danish-tender-guidelines", "complexity-calculator"]
   */
  skills?: string[];
}
