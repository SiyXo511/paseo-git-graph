# Paseo Git Graph

Paseo Git Graph adds a read-only history panel to a Paseo workspace. It shows the
commit graph, branch and tag labels, commit metadata, the files changed by a
commit, and the patch for each changed file.

The panel binds to the workspace that opened it. It reads the local Git
repository with bounded read-only commands, so the graph does not depend on a
model request or a separate server. Opening or refreshing the panel does not
fetch from a remote.

## Use

Open the workspace tab menu and choose Git Graph. The panel loads 200 commits
and appends the next 200 when the list reaches the end. Click a commit to see
its file summary; click a file to load its unified patch.

The panel requires Paseo 0.11.4 or newer and a Git repository in the workspace.
Git must be available on the daemon host. There are no accounts, tokens, or
plugin settings.

## Access and limits

The plugin reads commit metadata, refs, working-tree status, file summaries, and
patches from the local repository. It does not send repository data to a
provider. It does not expose checkout, merge, rebase, reset, cherry-pick,
revert, branch deletion, tag creation, stash, fetch, pull, push, or file
editing.

Very large repositories are loaded incrementally. Patch text is requested only
for the file opened, and binary files are reported as binary instead of being
shown as text.
