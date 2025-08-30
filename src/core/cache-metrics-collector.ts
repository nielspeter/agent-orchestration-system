import { ConversationLogger } from './conversation-logger';

export interface DetailedCacheMetrics {
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

export interface CacheSessionSummary {
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
 * Collects and analyzes cache metrics for performance monitoring
 */
export class CacheMetricsCollector {
  private readonly metrics: DetailedCacheMetrics[] = [];
  private readonly sessionId = this.generateSessionId();
  private readonly sessionStart = Date.now();

  constructor(private readonly logger?: ConversationLogger) {}

  /**
   * Record a cache metrics entry
   */
  recordMetrics(metrics: Partial<DetailedCacheMetrics>): void {
    const timestamp = new Date().toISOString();
    const requestId = this.generateRequestId();

    // Calculate derived metrics
    const totalInputTokens = (metrics.inputTokens || 0) + (metrics.cacheReadTokens || 0);
    const totalCreationTokens = metrics.cacheCreationTokens || 0;
    const hitRate = totalInputTokens > 0 ? (metrics.cacheReadTokens || 0) / totalInputTokens : 0;
    const missRate = 1 - hitRate;

    // Cost calculations (approximate rates for Claude)
    const inputRate = 0.000003; // $3 per 1M tokens
    const outputRate = 0.000015; // $15 per 1M tokens
    const cacheWriteRate = 0.000003; // Same as input
    const cacheReadRate = 0.0000003; // 10% of input rate

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

    const detailedMetrics: DetailedCacheMetrics = {
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
      this.logger.log({
        timestamp,
        agentName: 'CacheMetrics',
        depth: 0,
        type: 'system',
        content: `Cache metrics: ${Math.round(savingsPercentage)}% savings, ${Math.round(hitRate * 100)}% hit rate`,
        metadata: {
          cacheHitRate: hitRate,
          savingsPercentage: savingsPercentage,
          totalCost: totalCost,
          savings: savings,
          responseTime: detailedMetrics.responseTimeMs,
        },
      });
    }
  }

  /**
   * Get session summary
   */
  getSessionSummary(): CacheSessionSummary {
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
   * Get recent metrics
   */
  getRecentMetrics(count: number = 10): DetailedCacheMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log periodic summary
   */
  logPeriodicSummary(): void {
    const summary = this.getSessionSummary();

    if (this.logger && summary.totalRequests > 0) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName: 'CacheMetrics',
        depth: 0,
        type: 'result',
        content: `Session Summary: ${summary.totalRequests} requests, $${summary.totalSavings.toFixed(4)} saved (${Math.round((summary.totalSavings / (summary.totalCost + summary.totalSavings)) * 100)}%)`,
        metadata: {
          sessionSummary: summary,
        },
      });
    }
  }
}
