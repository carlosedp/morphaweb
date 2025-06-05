# Release Process

This project uses an automated release process that handles version updates and production deployments.

## Quick Release

To create a new release, you have two options:

### Option 1: Using the release script (Recommended)
```bash
# Create and push a new version tag
./scripts/release.sh v1.2.3
```

### Option 2: Using yarn
```bash
# Create and push a new version tag
yarn release v1.2.3
```

### Option 3: Manual process
```bash
# Make sure you're on main branch and it's clean
git checkout main
git pull origin main

# Create and push the tag
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

## What Happens Automatically

When you push a new version tag (like `v1.2.3`), the following happens automatically:

1. **GitHub Action Triggers**: The `Version Update and Production PR` workflow starts
2. **Version Update**: The version number in `src/index.js` is automatically updated
3. **Branch Creation**: A new branch `version-update-v1.2.3` is created with the version change
4. **Production PR**: A pull request is automatically created to merge into the `production` branch
5. **PR Details**: The PR includes:
   - Updated version number
   - Release notes template
   - Checklist for review
   - Automatic labels (if they exist)

## Production Deployment

1. **Review**: Check the automatically created PR for the version update
2. **Merge**: Once ready, merge the PR into the `production` branch
3. **Deploy**: GitHub Pages automatically deploys from the `production` branch
4. **Live**: Your new version is now live!

## Branch Structure

- `main`: Development branch where you work on features
- `production`: Production branch that gets deployed to GitHub Pages
- `version-update-*`: Temporary branches created for version updates

## Version Format

Use semantic versioning format: `v1.2.3` where:
- `1` = Major version (breaking changes)
- `2` = Minor version (new features)
- `3` = Patch version (bug fixes)

Examples:
- `v1.0.0` - Initial release
- `v1.1.0` - New features added
- `v1.1.1` - Bug fixes
- `v2.0.0` - Breaking changes

## Troubleshooting

### Tag already exists
```bash
# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push --delete origin v1.2.3

# Create new tag
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

### Working directory not clean
```bash
# Stash changes
git stash

# Or commit changes
git add .
git commit -m "Your commit message"
```

## Manual Override

If you need to update the version manually:

1. Edit `src/index.js` and change the version line:
   ```javascript
   const version = "v1.2.3";
   ```

2. Commit and push to main:
   ```bash
   git add src/index.js
   git commit -m "chore: update version to v1.2.3"
   git push origin main
   ```

3. Use the existing promote script:
   ```bash
   yarn promote
   ```
