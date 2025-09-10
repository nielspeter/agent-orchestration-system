# Testing Documentation

## Overview

A comprehensive testing strategy for the agent orchestration system, organized into 4 focused documents plus analysis.

## Document Structure

### 1. [testing-philosophy.md](testing-philosophy.md)
**The Foundation: Core Concepts & Principles**
- Why we can test non-deterministic systems
- The three-layer testing strategy
- "Test the rails, not the train"
- The sandwich of determinism
- Agent-generated test suites

### 2. [testing-strategy-comprehensive.md](testing-strategy-comprehensive.md) ⭐
**The Implementation: Complete Practical Guide**
- Consolidated strategy based on actual system investigation
- Testing pyramid (80% unit, 15% integration, 5% system)
- Universal tests every agent must pass
- Mock at LLM level, not tool level
- Code examples and implementation guide
- **START HERE for practical implementation**

### 3. [live-vs-audit-testing.md](live-vs-audit-testing.md)
**The Hidden Superpower: Mining Your Logs**
- Live testing vs audit log analysis comparison
- How to mine JSONL logs for free testing
- Replay testing against historical data
- Anomaly detection and regression analysis
- Cost optimization strategies

### 4. [behavior-optimization-strategy.md](behavior-optimization-strategy.md)
**The Optimization: A/B Testing for Agent Behaviors**
- Batch experiments vs dynamic adjustment
- Thompson Sampling for exploration/exploitation
- Contextual optimization per task type
- Finding optimal model and behavior settings
- Statistical significance in testing

### 5. [analysis-and-consolidation.md](analysis-and-consolidation.md)
**The Meta-Analysis: How We Consolidated**
- Documents what was merged and why
- Identified contradictions and resolutions
- Consolidation decisions and rationale
- Reference for maintenance

## Quick Start Guide

### If You're Implementing Tests Today

1. **Read** [testing-strategy-comprehensive.md](testing-strategy-comprehensive.md) - It has everything you need
2. **Create** MockLLMProvider from the code examples
3. **Implement** Universal test runner for safety tests
4. **Mine** your existing logs using the audit analyzer

### Key Testing Principles

1. **Mock at the LLM level**, not individual tools
2. **Use session logs** for verification 
3. **Universal tests are mandatory** for all agents
4. **Audit logs are free tests** - mine them aggressively
5. **Respect the pull architecture** - children gather own context

### Test Organization

```
tests/
├── unit/               # 80% - Mocked LLM tests
├── integration/        # 15% - Agent pair tests
├── universal/          # Mandatory safety tests
├── audit/              # Log mining tests
└── mocks/              # Test utilities
```

### Cost Breakdown

| Test Type | Implementation | Cost per Test | Frequency |
|-----------|---------------|---------------|-----------|
| Unit | MockLLMProvider | $0 | Every commit |
| Universal | Mocked or cheap model | $0-0.001 | Every PR |
| Integration | claude-3-5-haiku | $0.001 | Every PR |
| System | claude-3-5-haiku | $0.01 | Before merge |
| Audit | Log analysis | $0 | Daily/continuous |

## Why This Structure?

After analyzing 7 original documents, we found:
- Significant overlap between documents
- Contradictions between early and revised strategies
- Duplicate implementations of test runners

This consolidated structure:
- Eliminates contradictions (mocking strategy aligned)
- Removes duplicate content (single test runner implementation)
- Maintains unique valuable content (philosophy, audit testing, optimization)
- Provides clear implementation path

## Next Steps

1. **Today**: Implement MockLLMProvider and basic universal tests
2. **This Week**: Set up audit log analyzer for existing logs
3. **This Month**: Full test pyramid with CI/CD integration
4. **Ongoing**: A/B testing for behavior optimization

## The Bottom Line

- **Philosophy** ([testing-philosophy.md](testing-philosophy.md)): Understand WHY this works
- **Strategy** ([testing-strategy-comprehensive.md](testing-strategy-comprehensive.md)): Learn HOW to implement
- **Audit** ([live-vs-audit-testing.md](live-vs-audit-testing.md)): Mine logs for free insights
- **Optimize** ([behavior-optimization-strategy.md](behavior-optimization-strategy.md)): Find best settings

Start with the comprehensive strategy document - it's your complete implementation guide based on the actual system architecture.