# Publishing to npm

This document explains how to publish and install packages from the npm registry.

## Overview

This repository publishes public npm packages:
- `@nielspeter/agent-orchestration-core` - Core agent orchestration system
- `@nielspeter/agent-orchestration-cli` - CLI tool for running agents

## For Package Consumers (Installing Packages)

### Installation

Simply install the packages from npm - no authentication required for public packages:

```bash
npm install @nielspeter/agent-orchestration-core
npm install @nielspeter/agent-orchestration-cli
```

Or install the CLI globally:

```bash
npm install -g @nielspeter/agent-orchestration-cli
```

That's it! Public npm packages work out of the box.

## For Package Publishers (Releasing New Versions)

### Prerequisites

1. **npm Account**: Must have publish access to the packages
2. **Two-Factor Authentication**: Required for publishing
3. **Logged in**: Must be logged in via `npm login`

### One-Time Setup

#### Login to npm

```bash
npm login
# Enter your npm username, password, and OTP (from authenticator app)
```

Verify you're logged in:

```bash
npm whoami
# Should output: nielspeter
```

### Publishing New Versions

**All publishing is done manually** to ensure security and control.

#### Step 1: Update Versions

Update version numbers in both packages (keep them synchronized):

```bash
cd packages/core
npm version patch  # or minor, major

cd ../cli
npm version patch  # or minor, major
```

#### Step 2: Commit Version Changes

```bash
git add packages/core/package.json packages/cli/package.json package-lock.json
git commit -m "chore: bump packages to vX.Y.Z"
git push
```

#### Step 3: Create and Push Git Tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

#### Step 4: Build and Test

```bash
# Build core
cd packages/core
npm run build
npm test

# Build CLI
cd ../cli
npm run build
npm test
```

#### Step 5: Publish to npm

Get your OTP code from your authenticator app, then publish:

```bash
# Publish core
cd packages/core
npm publish --otp=XXXXXX

# Publish CLI
cd ../cli
npm publish --otp=XXXXXX
```

Replace `XXXXXX` with your current 6-digit OTP code.

### Version Strategy

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

Use npm version commands:
```bash
npm version patch  # 1.1.0 → 1.1.1
npm version minor  # 1.1.1 → 1.2.0
npm version major  # 1.2.0 → 2.0.0
```

**Important:** Keep both packages at the same version number for consistency.

### Publishing Checklist

Before publishing, ensure:
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Changes are committed and pushed
- [ ] Version tag is created and pushed
- [ ] CHANGELOG is updated (if applicable)
- [ ] Both packages have same version number

## Troubleshooting

### "You must be logged in to publish packages"

```bash
npm login
npm whoami  # Verify you're logged in
```

### "You do not have permission to publish"

You need publish access to the packages. Contact the package owner.

### "Cannot publish over existing version"

Each version can only be published once. Bump the version:

```bash
npm version patch
```

### "Missing or invalid OTP"

Make sure you're using a fresh OTP code from your authenticator app:

```bash
npm publish --otp=XXXXXX
```

If it fails, get a new OTP code and try again (codes expire after 30 seconds).

### "This package requires two-factor authentication"

This is expected. Always use `--otp=XXXXXX` flag when publishing:

```bash
npm publish --otp=123456
```

## Package URLs

After publishing, packages are available at:
- https://www.npmjs.com/package/@nielspeter/agent-orchestration-core
- https://www.npmjs.com/package/@nielspeter/agent-orchestration-cli

## Additional Resources

- [npm Documentation](https://docs.npmjs.com/)
- [Publishing npm packages](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [Two-Factor Authentication](https://docs.npmjs.com/about-two-factor-authentication)
