# Publishing to GitHub Packages

This document explains how to publish and install packages from GitHub Packages.

## Overview

This repository publishes private npm packages to GitHub Packages:
- `@agent-system/core` - Core agent orchestration system
- `@agent-system/cli` - CLI tool for running agents

## For Package Consumers (Installing Packages)

### 1. Create a GitHub Personal Access Token (PAT)

You need a PAT with `read:packages` scope to install packages from GitHub Packages.

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Or visit: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "npm-github-packages")
4. Select scopes:
   - ✅ `read:packages` (required for installing)
   - ✅ `write:packages` (only if you need to publish)
5. Click "Generate token" and **copy the token immediately** (you won't see it again)

### 2. Configure npm Authentication

Create or edit `~/.npmrc` in your home directory:

```bash
# Add this line to ~/.npmrc
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Replace `YOUR_GITHUB_TOKEN` with the PAT you created.

**Important**: Never commit `.npmrc` with tokens to git!

### 3. Configure Package Scope

Tell npm to use GitHub Packages for the `@agent-system` scope:

```bash
# Add to ~/.npmrc
@agent-system:registry=https://npm.pkg.github.com
```

Or use npm config:

```bash
npm config set @agent-system:registry https://npm.pkg.github.com
```

### 4. Install Packages

Now you can install the packages:

```bash
npm install @agent-system/core
npm install @agent-system/cli
```

### Quick Setup Script

```bash
# 1. Set your GitHub token (replace with your actual token)
GITHUB_TOKEN="ghp_your_token_here"

# 2. Configure npm
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc
echo "@agent-system:registry=https://npm.pkg.github.com" >> ~/.npmrc

# 3. Install packages
npm install @agent-system/core @agent-system/cli
```

## For Package Publishers (Releasing New Versions)

### Automated Publishing (Recommended)

The repository uses GitHub Actions for automated publishing on version tags:

1. Update version in package.json:
   ```bash
   cd packages/core
   npm version patch  # or minor, major
   ```

2. Commit and push the version bump:
   ```bash
   git add packages/core/package.json
   git commit -m "chore: bump core version to X.Y.Z"
   git push
   ```

3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. GitHub Actions will automatically:
   - Build the packages
   - Run tests
   - Publish to GitHub Packages

### Manual Publishing

If you need to publish manually:

1. Ensure you have a PAT with `write:packages` scope

2. Authenticate:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   # Username: your-github-username
   # Password: your-github-token (PAT)
   # Email: your-email
   ```

3. Build and publish:
   ```bash
   # Publish core
   cd packages/core
   npm run prepublishOnly  # Builds and tests
   npm publish

   # Publish CLI
   cd ../cli
   npm run prepublishOnly
   npm publish
   ```

## Troubleshooting

### "Unable to authenticate" or 401 Unauthorized

- Verify your PAT has `read:packages` (or `write:packages` for publishing)
- Check that `.npmrc` has the correct token
- Ensure the token hasn't expired
- Verify the scope configuration: `@agent-system:registry=https://npm.pkg.github.com`

### "Package not found" or 404

- Ensure the package has been published at least once
- Verify you have access to the repository (private packages)
- Check the package name matches exactly (case-sensitive)

### "EPERM: operation not permitted" on Windows

- Make sure `.npmrc` uses Unix-style paths
- Try using Git Bash or WSL instead of Command Prompt

### Publishing fails in GitHub Actions

- Check that the workflow has `packages: write` permission
- Verify the `GITHUB_TOKEN` secret is available (it's automatic)
- Ensure tests pass before publishing

## Package Visibility

All packages are currently **private** and require authentication. Only users with access to the repository can install them.

To make packages public (optional):
1. Go to repository Settings → Packages
2. Select the package
3. Click "Package settings"
4. Change visibility to "Public"

## Version Strategy

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

Use npm version commands:
```bash
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.1 → 0.2.0
npm version major  # 0.2.0 → 1.0.0
```

## Additional Resources

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Working with npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [About PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
