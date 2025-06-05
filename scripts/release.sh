#!/bin/bash

# Version Release Script for Morphaweb
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh v1.2.3

set -e

# Check if version is provided
if [ -z "$1" ]; then
  echo "❌ Error: Version number is required"
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.2.3"
  exit 1
fi

VERSION="$1"

# Validate version format (should start with v and follow semver)
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
  echo "⚠️  Warning: Version should follow format v1.2.3"
  echo "Proceeding with: $VERSION"
fi

echo "🚀 Preparing release: $VERSION"

# Make sure we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Error: You must be on the main branch to create a release"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Make sure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Working directory is not clean. Please commit or stash your changes."
  git status --short
  exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Check if tag already exists
if git tag -l | grep -q "^$VERSION$"; then
  echo "❌ Error: Tag $VERSION already exists"
  exit 1
fi

# Create and push tag
echo "🏷️  Creating tag: $VERSION"
git tag -a "$VERSION" -m "Release $VERSION"

echo "📤 Pushing tag to origin..."
git push origin "$VERSION"

echo ""
echo "✅ Release $VERSION created successfully!"
echo ""
echo "📋 What happens next:"
echo "1. GitHub Action will automatically:"
echo "   - Update version in src/index.js"
echo "   - Create a PR to the production branch"
echo "2. Review and merge the PR to deploy to production"
echo "3. GitHub Pages will automatically deploy the new version"
echo ""
echo "🔗 Monitor the action at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
