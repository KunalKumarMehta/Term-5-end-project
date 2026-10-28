# Test files embed the core Scenario verbatim, and released rule IDs never change meaning

A Test file's `scenario:` is exactly the JSON that `simulate()` takes, written as YAML with every defaulted field written out, and a pin's `root` is a bare rule ID. Both live in Maintainers' own repositories, so the core's Scenario shape and the rule ID table become public contracts: one schema serves the core, the CLI and the playground, and the Test file carries its own `version: 1`, independent of the package version. A released rule ID never changes meaning and a retired ID is never reused; a release that changes any pinned `value`, `possible` or `root` is at least a minor version and lists the affected rule IDs.

## Considered Options

- **A friendlier hand-written Scenario shape, translated to the core's.** Nicer to type, but two schemas and a translator to keep in step, and the playground would need the translator in the browser too.
- **Pin a rule's text or a stable hash instead of its ID.** Survives renumbering, but rule text is edited for wording, and a hash is unreadable in a PR diff.

## Consequences

- Any change to the core's Scenario shape needs a Test file `version` bump and a loader for the old version.
- Correcting a rulebook row can still change pinned roots; the README pins the Action to an exact release so that arrives as its own PR, fixed with `whynorun test --update`.
- A pin field that is missing is not compared; an explicit `null` means the Verdict must not have it.
