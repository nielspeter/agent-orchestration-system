import type { BuildResult } from '@/config/system-builder';
import { AgentSystemBuilder } from '@/config/system-builder';
import type { SystemConfig } from '@/config/types';

export async function createTestExecutor(config?: Partial<SystemConfig>): Promise<BuildResult> {
  const builder = AgentSystemBuilder.forTest({
    model: 'claude-3-5-haiku-latest',
    agents: { directories: [] },
    tools: { builtin: [], custom: [] },
    ...config,
  });
  return builder.build();
}

export async function createMinimalExecutor(): Promise<BuildResult> {
  const builder = AgentSystemBuilder.minimal();
  return builder.build();
}
