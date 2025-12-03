# Changesets

This project uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a Changeset

When you make a change that should be documented in the changelog, run:

```bash
npm run changeset
```

This will prompt you to:

1. Select the type of change (patch, minor, major)
2. Write a summary of your changes

The command creates a markdown file in this directory that will be consumed when a release is made.

## Change Types

- **patch**: Bug fixes and minor changes that don't affect the API
- **minor**: New features that are backwards compatible
- **major**: Breaking changes

## Skipping Changesets

For changes that don't need to be documented (typos, internal refactors, CI changes), add the `no-changeset` label to your PR.
