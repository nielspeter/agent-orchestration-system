import { AgentLogger } from '@/logging';

export interface ModelPricing {
  input: number; // Cost per 1K tokens
  output: number; // Cost per 1K tokens
}

export interface DetailedLLMMetrics {
  // Request metadata
  timestamp: string;
  sessionId: string;
  requestId: string;
  modelName: string;

  // Token counts
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;

  // Cache statistics
  cacheHitRate: number;
  cacheMissRate: number;
  totalCachedBlocks: number;
  newCacheBlocks: number;

  // Cost calculations
  baseCostUSD: number;
  cacheCreationCostUSD: number;
  cacheReadCostUSD: number;
  totalCostUSD: number;
  savingsUSD: number;
  savingsPercentage: number;

  // Performance metrics
  responseTimeMs: number;
  cacheEfficiency: number; // 0-1 scale
}

export interface LLMSessionSummary {
  sessionId: string;
  startTime: string;
  endTime: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  totalSavings: number;
  avgCacheHitRate: number;
  avgResponseTime: number;
  efficiency: number;
}

/**
 * Collects and analyzes LLM request metrics for performance monitoring
 * Tracks tokens, costs, cache performance, and response times
 */
export class LLMMetricsCollector {
  private readonly metrics: DetailedLLMMetrics[] = [];
  private readonly sessionId = this.generateSessionId();
  private readonly sessionStart = Date.now();

  constructor(private readonly logger?: AgentLogger) {}

  /**
   * Record LLM request metrics
   * @param metrics The metrics to record
   * @param pricing Optional model-specific pricing (per 1K tokens)
   */
  recordMetrics(metrics: Partial<DetailedLLMMetrics>, pricing?: ModelPricing): void {
    const timestamp = new Date().toISOString();
    const requestId = this.generateRequestId();

    // Calculate derived metrics
    const totalInputTokens = (metrics.inputTokens || 0) + (metrics.cacheReadTokens || 0);
    const totalCreationTokens = metrics.cacheCreationTokens || 0;
    const hitRate = totalInputTokens > 0 ? (metrics.cacheReadTokens || 0) / totalInputTokens : 0;
    const missRate = 1 - hitRate;

    // Cost calculations - use provided pricing or fall back to Sonnet defaults
    // Convert from per-1K to per-token rates
    const inputRate = pricing ? pricing.input / 1000 : 0.000003; // Default: $3 per 1M tokens
    const outputRate = pricing ? pricing.output / 1000 : 0.000015; // Default: $15 per 1M tokens
    const cacheWriteRate = inputRate; // Same as input
    const cacheReadRate = inputRate * 0.1; // 10% of input rate

    const baseCost = totalInputTokens * inputRate + (metrics.outputTokens || 0) * outputRate;
    const cacheCreationCost = totalCreationTokens * cacheWriteRate;
    const cacheReadCost = (metrics.cacheReadTokens || 0) * cacheReadRate;
    const totalCost = baseCost + cacheCreationCost + cacheReadCost;

    // Calculate savings compared to no caching
    const noCacheCost =
      ((metrics.inputTokens || 0) + totalCreationTokens) * inputRate +
      (metrics.outputTokens || 0) * outputRate;
    const savings = Math.max(0, noCacheCost - totalCost);
    const savingsPercentage = noCacheCost > 0 ? (savings / noCacheCost) * 100 : 0;

    const detailedMetrics: DetailedLLMMetrics = {
      timestamp,
      sessionId: this.sessionId,
      requestId,
      modelName: metrics.modelName || 'unknown',
      inputTokens: metrics.inputTokens || 0,
      outputTokens: metrics.outputTokens || 0,
      cacheCreationTokens: totalCreationTokens,
      cacheReadTokens: metrics.cacheReadTokens || 0,
      cacheHitRate: hitRate,
      cacheMissRate: missRate,
      totalCachedBlocks: metrics.totalCachedBlocks || 0,
      newCacheBlocks: metrics.newCacheBlocks || 0,
      baseCostUSD: baseCost,
      cacheCreationCostUSD: cacheCreationCost,
      cacheReadCostUSD: cacheReadCost,
      totalCostUSD: totalCost,
      savingsUSD: savings,
      savingsPercentage: savingsPercentage,
      responseTimeMs: metrics.responseTimeMs || 0,
      cacheEfficiency: hitRate,
    };

    this.metrics.push(detailedMetrics);

    // Log metrics
    if (this.logger) {
      this.logger.logSystemMessage(
        `Cache metrics: ${Math.round(savingsPercentage)}% savings, ${Math.round(hitRate * 100)}% hit rate`
      );
    }
  }

  /**
   * Get session summary
   */
  getSessionSummary(): LLMSessionSummary {
    if (this.metrics.length === 0) {
      return {
        sessionId: this.sessionId,
        startTime: new Date(this.sessionStart).toISOString(),
        endTime: new Date().toISOString(),
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        totalSavings: 0,
        avgCacheHitRate: 0,
        avgResponseTime: 0,
        efficiency: 0,
      };
    }

    const totalRequests = this.metrics.length;
    const totalTokens = this.metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const totalCost = this.metrics.reduce((sum, m) => sum + m.totalCostUSD, 0);
    const totalSavings = this.metrics.reduce((sum, m) => sum + m.savingsUSD, 0);
    const avgHitRate = this.metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / totalRequests;
    const avgResponseTime =
      this.metrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / totalRequests;

    return {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStart).toISOString(),
      endTime: new Date().toISOString(),
      totalRequests,
      totalTokens,
      totalCost,
      totalSavings,
      avgCacheHitRate: avgHitRate,
      avgResponseTime,
      efficiency: avgHitRate,
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Log periodic summary
   */
  logPeriodicSummary(): void {
    const summary = this.getSessionSummary();

    if (this.logger && summary.totalRequests > 0) {
      this.logger.logSystemMessage(
        `Session Summary: ${summary.totalRequests} requests, $${summary.totalSavings.toFixed(4)} saved (${Math.round((summary.totalSavings / (summary.totalCost + summary.totalSavings)) * 100)}%)`
      );
    }
  }
}
