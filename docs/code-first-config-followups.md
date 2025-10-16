# Follow-up Issues: Code-First Configuration

This document tracks follow-up improvements after the code-first configuration feature was implemented.

---

## Issue 1: Runtime Validation of ProvidersConfig

**Priority:** Medium | **Type:** Enhancement | **Labels:** `enhancement`, `config`, `validation`

### Description
Currently, `withProvidersConfig()` accepts a `ProvidersConfig` object with only TypeScript compile-time validation. Runtime validation would provide better error messages.

### Proposed Solution
```typescript
withProvidersConfig(config: ProvidersConfig): AgentSystemBuilder {
  // Validate providers exist
  if (!config.providers || typeof config.providers !== 'object') {
    throw new Error('ProvidersConfig must have a "providers" object');
  }
  
  if (Object.keys(config.providers).length === 0) {
    throw new Error('ProvidersConfig must have at least one provider');
  }
  
  // Validate each provider
  for (const [name, provider] of Object.entries(config.providers)) {
    if (!provider.type || !['native', 'openai-compatible'].includes(provider.type)) {
      throw new Error(`Provider "${name}" has invalid or missing type`);
    }
    if (!provider.apiKeyEnv) {
      throw new Error(`Provider "${name}" must have an "apiKeyEnv" field`);
    }
  }
  
  return this.with({ providersConfig: config });
}
```

### Acceptance Criteria
- [ ] Runtime validation implemented
- [ ] Tests for invalid configs
- [ ] Clear error messages
- [ ] Documentation updated

---

## Issue 2: Security Documentation Update

**Priority:** Medium | **Type:** Documentation | **Labels:** `documentation`, `security`

### Description
Document API key handling security implications and best practices in `docs/security.md`.

### Proposed Content

#### API Key Handling

**Storage:**
- Keys stored in memory as plain strings (standard practice)
- Not persisted to disk or logs
- Not exposed in error messages

**Precedence:**
1. Programmatic (`.withAPIKeys()`) - highest priority
2. Environment variables (`process.env`) - fallback

**Best Practices:**

Development:
```bash
export ANTHROPIC_API_KEY=your-key-here
```

Production:
```typescript
const apiKeys = {
  ANTHROPIC_API_KEY: await secretsManager.getSecret('anthropic-key'),
};
const system = await AgentSystemBuilder.default()
  .withAPIKeys(apiKeys)
  .build();
```

Testing:
```typescript
const system = await AgentSystemBuilder.minimal()
  .withAPIKeys({ ANTHROPIC_API_KEY: 'test-key' })
  .build();
```

**Secret Manager Integration (AWS Example):**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretId: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  return response.SecretString || '';
}

const apiKeys = {
  ANTHROPIC_API_KEY: await getSecret('prod/anthropic-api-key'),
};
```

**Key Rotation:**
1. Add new key to secret manager
2. Deploy with updated reference
3. Grace period for old sessions
4. Remove old key

### Acceptance Criteria
- [ ] New section in `docs/security.md`
- [ ] Examples for dev/prod/test
- [ ] Secret manager integration examples
- [ ] Key rotation guidance

---

## Issue 3: Refactor types.ts When It Grows Larger

**Priority:** Low | **Type:** Technical Debt | **Labels:** `refactoring`, `tech-debt`

### Description
`types.ts` is ~470 lines. Consider refactoring when it exceeds 500 lines.

### Proposed Structure
```
src/config/
├── types/
│   ├── index.ts          # Re-exports
│   ├── agent.types.ts    
│   ├── model.types.ts    # ModelConfig, ProviderConfig, ProvidersConfig
│   ├── safety.types.ts   
│   ├── system.types.ts   
│   └── storage.types.ts  
├── merge.ts              # mergeConfigs()
├── resolve.ts            # resolveConfig()
└── defaults.ts           # DEFAULT_SYSTEM_CONFIG
```

### Benefits
- Easier navigation (smaller files)
- Clear type ownership
- Better IDE performance
- Clearer mental model

### Migration Strategy
1. Create `types/` directory
2. Move types to focused files
3. Create re-export index
4. Keep backward compatibility
5. Test thoroughly
6. Update docs

### Acceptance Criteria
- [ ] Only when file > 500 lines
- [ ] All types split logically
- [ ] Backward-compatible re-exports
- [ ] All 496 tests pass
- [ ] No breaking changes

### Non-Goals
- Don't do prematurely (YAGNI)
- Don't change types
- Don't break compatibility

---

## Summary

Three follow-up issues to address:

1. **Runtime Validation** - Better developer experience
2. **Security Docs** - Document best practices  
3. **Code Organization** - Maintain as code grows

All medium-to-low priority, can be done incrementally.
