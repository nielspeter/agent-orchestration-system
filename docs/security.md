# Security Features

This document outlines the security measures implemented in the Agent Orchestration System.

## 🔒 File System Security

### Path Validation
The system blocks access to sensitive files and directories:

**Blocked Patterns:**
- `.ssh/id_[rd]sa` - Private SSH keys
- `.aws/credentials` - AWS credentials  
- `.env` - Environment files (root only, allows .env.example, .env.test)
- `/etc/shadow` - System password hashes
- `.gnupg/` - GPG keys
- `.docker/config.json` - Docker credentials
- `.kube/config` - Kubernetes credentials

**Warning Patterns:**
The system warns when accessing potentially sensitive paths:
- `/etc/` - System configuration
- `~/` - Home directory
- `.git/` - Git repository internals
- `node_modules/` - Dependencies

### File Size Limits
To prevent memory exhaustion:
- **Max Read Size**: 50MB
- **Max Read Lines**: 10,000 lines
- **Max Line Length**: 5,000 characters
- **Max Write Size**: 10MB

## 🛡️ Shell Command Security

### Catastrophic Command Prevention
The shell tool blocks commands that could destroy the system:

**Blocked Patterns:**
- `rm -rf /` - Recursive root deletion
- `rm --no-preserve-root` - Force root deletion
- `mkfs` - Filesystem formatting
- `dd of=/dev/[sh]d*` - Direct disk writes
- `:(){ :|:& };:` - Fork bombs
- `>/dev/[sh]da` - Disk overwriting
- `chmod -R 000 /` - Permission removal

**Risky Command Warnings:**
The system warns on potentially dangerous commands:
- `sudo` - Elevated privileges
- `rm -rf` - Recursive deletion
- `chmod` - Permission changes
- `chown` - Ownership changes

### Output Limits
- **Max Output**: 500KB (prevents memory exhaustion)
- **Max Buffer**: 10MB for command execution

## 🔄 Reliability Features

### Retry Logic
Built-in retry mechanism for transient failures:
- **Configurable retry count** (default: 0, can be set per-tool)
- **Linear backoff**: 1s, 2s, 3s between retries
- **Smart retry detection**: Only retries on:
  - Network errors (ECONNRESET, ETIMEDOUT)
  - Server errors (HTTP 500+)
- **Does NOT retry** on client errors (4xx) or validation failures

### Timeout Protection
- **Default timeout**: 30s for shell commands
- **Configurable timeout**: Can be set per-command
- **Tool execution timeout**: Default 5s, configurable per-tool

## 📊 Monitoring & Metrics

### Cache Metrics Collection
The system tracks:
- Token usage (input, output, cache)
- Cache hit rates
- Cost calculations and savings
- Response times
- Session summaries
- Efficiency metrics

### Logging Security
- Sensitive data is never logged
- Fire-and-forget logging prevents blocking
- Structured event logging for audit trails

## 🚫 Known Limitations

### What is NOT Protected
1. **API Rate Limiting**: No built-in rate limiting for LLM API calls
2. **Authentication**: No user authentication/authorization
3. **Network Isolation**: No network segmentation
4. **Secrets Management**: No built-in secrets vault
5. **Input Sanitization**: Limited validation of user inputs

### Security Assumptions
- **Trusted Environment**: Assumes deployment in a trusted environment
- **Trusted Users**: No multi-tenant isolation
- **Local Execution**: Designed for local or controlled server deployment

## 🛠️ Security Configuration

### Customizing Security Rules

You can modify security patterns in:
- `src/tools/file.tool.ts` - File access patterns
- `src/tools/shell.tool.ts` - Shell command patterns

### Recommended Production Settings

```typescript
// In agent-config.json
{
  "safety": {
    "maxIterations": 20,      // Limit LLM calls (default)
    "maxDepth": 10,           // Limit delegation depth (default)
    "maxTokensEstimate": 50000  // Prevent large requests (default)
  },
  "tools": {
    "builtin": [
      "read",    // Safe
      "write",   // Use with caution
      "list",    // Safe
      "grep",    // Safe
      // "shell" - Consider removing in production
      "task"     // Safe
    ]
  }
}
```

## 🔐 Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Use environment variables, not hardcoded values
3. **File Access**: Run with minimal required permissions
4. **Shell Access**: Consider disabling shell tool in production
5. **Monitoring**: Enable logging and review regularly
6. **Updates**: Keep dependencies updated

## 🚨 Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** open a public issue
2. Contact the maintainers directly
3. Provide detailed reproduction steps
4. Allow time for a fix before disclosure

## 📋 Security Checklist for Deployment

- [ ] Review and customize blocked path patterns
- [ ] Review and customize blocked command patterns  
- [ ] Disable shell tool if not needed
- [ ] Set appropriate file size limits
- [ ] Configure retry and timeout values
- [ ] Enable comprehensive logging
- [ ] Implement API rate limiting
- [ ] Add authentication layer
- [ ] Run with minimal permissions
- [ ] Regular security audits