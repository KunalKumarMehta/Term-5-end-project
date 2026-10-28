# Share links carry the playground's state in the URL fragment

With no backend, a share link carries its whole state after the `#`. GitHub Pages never sees that part. The state is compressed with deflate-raw and written as `#v1.<unpadded base64url>.0`. The trailing `.0` stops GitHub's autolinker from dropping a last character that is punctuation. It also lets a link that lost its tail report that it was cut off.

What the link holds depends on the Workflow set:
- **An unedited import** travels as `{owner, repo, ref, sha}` and is imported again when the link is opened.
- **Anything else** travels as its files.

The link also carries both Scenarios, each with its per-field source map, and the open Explanation.

## Considered Options

- **A backend or gists to store state.** Links would be short and of any size. But it needs accounts or a server, and both are out of scope.
- **Always carrying the files.** The link would still open after the repo goes private or is deleted. But most real Workflow sets would be over the 4,000-character size that chat apps keep intact. A reference pinned to a SHA always names the same files.
- **Tying the link's version to the Test file `version`.** It would use one number. But a change that affects only the link would then force a Test file version bump, with a new loader and churn in every Maintainer's committed Test files.

## Consequences

- **Links are public and permanent.** Links already posted in issues and chats can't be updated. Each link records two versions: its own wrapper version, which is the `vN` prefix, and the embedded Scenario's Test file `version`. Old Scenarios load through ADR 0002's loaders. A change to the wrapper bumps the prefix, and later releases keep opening older prefixes.
- **A link is untrusted input**, and so is the localStorage draft, because every page on `kunalkumarmehta.github.io` shares that storage. Both go through one validation that has size limits. The fragment is removed before it is decoded, so a link that crashes the tab doesn't crash it again on reload.
- **Opening a reference link calls the GitHub API** from the visitor's browser and spends their unauthenticated rate limit.
