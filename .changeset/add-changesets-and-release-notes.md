---
"z-reader": patch
---

Add changesets workflow and release notes in update banner

- Add changesets for versioning and changelog generation
- CI now requires changeset on PRs (or `no-changeset` label to skip)
- Automatic GitHub Releases when version PR is merged
- Update banner now shows version diff (e.g., v1.0.3 → v1.0.4)
- Expandable "what's new" section fetches release notes from GitHub
- Link to full release notes on GitHub
- Version now sourced from package.json (single source of truth)
- GITHUB_REPO configurable via VITE_GITHUB_REPO env var for beta builds
