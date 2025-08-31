export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  execute: (input: ToolInput) => Promise<ToolOutput>;
  isConcurrencySafe?: () => boolean;
  category?: string;
  metadata?: Record<string, unknown>;
}