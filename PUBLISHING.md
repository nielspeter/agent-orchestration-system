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

1. **npm Account**: Create an account at https://www.npmjs.com/signup
2. **Two-Factor Authentication**: Enable 2FA on your npm account (required for publishing)
3. **Access**: You must be added as a maintainer to publish these packages

### One-Time Setup

#### 1. Login to npm

```bash
npm login
# Enter your npm username, password, and OTP (if 2FA enabled)
```

Verify you're logged in:

```bash
npm whoami
# Should output: nielspeter
```

#### 2. Setup NPM_TOKEN for GitHub Actions

To enable automated publishing via GitHub Actions:

1. Generate an npm automation token:
   ```bash
   npm token create --type automation
   ```

2. Copy the token (starts with `npm_`)

3. Add it to GitHub repository secrets:
   - Go to: https://github.com/nielspeter/agent-orchestration-system/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste the automation token
   - Click "Add secret"

### Publishing New Versions

#### Automated Publishing (Recommended)

The repository uses GitHub Actions for automated publishing on version tags:

1. **Update version in package.json:**
   ```bash
   cd packages/core
   npm version patch  # or minor, major

   cd ../cli
   npm version patch  # or minor, major
   ```

2. **Commit and push the version bump:**
   ```bash
   git add packages/core/package.json packages/cli/package.json package-lock.json
   git commit -m "chore: bump packages to vX.Y.Z"
   git push
   ```

3. **Create and push a git tag:**
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. **GitHub Actions will automatically:**
   - Build the packages
   - Run tests
   - Publish to npm registry

5. **Monitor the workflow:**
   - Check: https://github.com/nielspeter/agent-orchestration-system/actions
   - Look for the "Publish Packages to npm" workflow

#### Manual Publishing

If you need to publish manually:

1. **Build and test:**
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

2. **Publish:**
   ```bash
   # Publish core
   cd packages/core
   npm publish

   # Publish CLI
   cd ../cli
   npm publish
   ```

The `publishConfig.access: "public"` in package.json ensures packages are published as public.

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

## Troubleshooting

### "You must be logged in to publish packages"

```bash
npm login
npm whoami  # Verify you're logged in
```

### "You do not have permission to publish"

You need to be added as a maintainer. Contact the package owner.

### "Cannot publish over existing version"

Each version can only be published once. Bump the version:

```bash
npm version patch
```

### "Missing or invalid OTP"

If 2FA is enabled, you'll need to provide a one-time password:

```bash
npm publish --otp=123456
```

### GitHub Actions publishing fails

1. Verify `NPM_TOKEN` secret is set in repository settings
2. Check the token hasn't expired
3. Ensure the token has publish permissions
4. View workflow logs for specific error

## Package URLs

After publishing, packages will be available at:
- https://www.npmjs.com/package/@nielspeter/agent-orchestration-core
- https://www.npmjs.com/package/@nielspeter/agent-orchestration-cli

## Additional Resources

- [npm Documentation](https://docs.npmjs.com/)
- [Publishing npm packages](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm tokens](https://docs.npmjs.com/about-access-tokens)
