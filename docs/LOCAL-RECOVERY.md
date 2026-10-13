# Existing local installations

Before adopting the command contract, stop the old installer and development server. Preserve `.dev.vars` and the complete `.wrangler/vector-dev` directory in an owner-only backup outside the checkout. The new CLI refuses legacy state and never moves or deletes it automatically.

For an unambiguous old installation with no `.wrangler/state`, after backing up, move the entire `.wrangler/vector-dev` directory to `.wrangler/state`. Keep `.dev.vars` byte-for-byte. Run setup with the same saved owner and origin, and verify your existing records and files. If both locations exist, preserve both and reconcile in an isolated checkout; never merge SQLite or R2 directories blindly. Compatible source rollback retains the additive schema and restores the prior persistence path explicitly.
