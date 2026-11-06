# Native installed agents

Owners and Admins install named native agents under Settings → Developers. Each installation selects one currently visible team and explicitly grants issue reads, with optional title changes. The one-time credential is separate from every personal token and OAuth grant. It admits only a detail read or a version-checked title edit through the existing versioned issue API. Other mutations, list traversal, browser sessions and management operations are refused.

Every call rechecks the actor, credential, installer, current role, workspace and selected team visibility. The native edit transaction checks the same admission before and after its statements. Pause stops reads and writes immediately. Revocation is terminal and destroys the credential while preserving safe identity and attributed history. An installer who loses access cannot use the installed identity to recover it.

Activity and workspace audit retain the agent's own ID and saved name, plus its accountable installer. Human changes remain human. Existing member erasure revokes installed credentials and clears the saved installer name; the safe agent identity and opaque history remain. Archives preserve identities and attribution, exclude credentials and restore every historical installation without usable authority. Restoring an active state does not restore its credential. Granting future access requires an explicit new installation.

This slice qualifies one native agent's issue read and title edit. Broader integration and automation actors, other coding-agent mutations, third-party OAuth actors, delegation and callback transports remain unqualified. Existing Base Business management and approval custody are unchanged.
