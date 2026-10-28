# The Action runs a committed bundle, and Pages serves only released versions

The CLI and the Action ship as esbuild bundles committed to `dist/` on `main`. CI rebuilds them and fails when `dist/` differs in any way, including stale or extra files. The Action is a `node24` JavaScript action whose `main` is `dist/action.mjs`, so it runs from the tagged checkout with no install step and no network. The playground deploys to Pages only from the release workflow, never from a push to `main`. So the playground, the npm package and the Action at a given tag all run the same rules. A Behaviour test pinned in the playground can only disagree with CI when the Maintainer's Action pin is older.

## Considered Options

- **`npx whynorun@<version>` from a composite Action.** Nothing generated is committed, but every run downloads at run time, which breaks "the Action never uses the network". It also uses whatever Node the runner has, and puts the version pin in two places.
- **Build `dist/` only on release tags, on a release commit off `main`.** This keeps `main` free of generated code, but tags would point at commits CI never checked, and `uses: ./` dogfooding on PRs would have nothing to run.
- **Deploy Pages on every push to `main`.** The live link would update sooner, but the playground's rules would get ahead of every released Action. A Maintainer's freshly pinned Test file could then fail in CI for reasons no released version explains.

## Consequences

- Every npm bump of a bundled dependency (including Dependabot's) needs a rebuild and a commit of `dist/` before it can merge. The red freshness check says so.
- Generated code is in diffs. `dist/` is marked `linguist-generated`, and review relies on the freshness check, not on reading the bundle.
- The live link changes only when a release is cut. Until `0.1.0` it shows the README.
- Bundling drops the dependencies' own LICENSE files, so the build writes `dist/THIRD_PARTY_LICENSES.md`, and the Pages build writes its own copy.
