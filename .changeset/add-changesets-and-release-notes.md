---
'z-reader': patch
---

Add changesets workflow, release notes, and fix cross-site imports

### New Features
- Add changesets for versioning and changelog generation
- CI now requires changeset on PRs (or `no-changeset` label to skip)
- Automatic GitHub Releases when version PR is merged
- Update banner now shows version diff (e.g., v1.0.3 → v1.0.4)
- Expandable "what's new" section fetches release notes from GitHub
- Link to full release notes on GitHub
- Version now sourced from package.json (single source of truth)
- GITHUB_REPO configurable via VITE_GITHUB_REPO env var for beta builds

### Bug Fixes
- Fix cross-site imports via `/upload?manga=X&volume=Y` URLs (regression from hash router migration)
- Add catch-all route to handle legacy URL paths
- Fix hash-based navigation when on legacy paths
- Cross-site imports now use global progress tracker instead of dedicated page
