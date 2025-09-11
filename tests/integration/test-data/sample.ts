// Sample TypeScript file demonstrating design patterns and architecture

// Singleton Pattern
class PatternManager {
  private static instance: PatternManager;

  private constructor() {}

  static getInstance(): PatternManager {
    if (!PatternManager.instance) {
      PatternManager.instance = new PatternManager();
    }
    return PatternManager.instance;
  }
}

// Basic architecture with interfaces
interface Architect {
  design(): string;
  build(): void;
}

// Middleware pattern
class MiddlewareChain {
  private readonly middlewares: (() => void)[] = [];

  use(fn: () => void) {
    this.middlewares.push(fn);
  }

  execute() {
    // Pipeline pattern
    this.middlewares.forEach((mw) => mw());
  }
}

// Config interface
interface Config {
  name: string;
  value: number;
  tool?: string;
}

// Main class demonstrating patterns
class DesignArchitect implements Architect {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  design(): string {
    return `Designing ${this.config.name}`;
  }

  build(): void {
    console.log('Building architecture');
  }
}

// Pipeline class
class Pipeline {
  process(data: any) {
    return data;
  }
}

export { PatternManager, DesignArchitect, MiddlewareChain, Pipeline, Config, Architect };
