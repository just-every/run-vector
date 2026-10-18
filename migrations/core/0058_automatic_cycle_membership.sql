-- Opt-in rules; all existing teams keep manual commitment and their history.
ALTER TABLE teams ADD COLUMN auto_cycle_started INTEGER NOT NULL DEFAULT 0 CHECK(auto_cycle_started IN (0,1));
ALTER TABLE teams ADD COLUMN auto_cycle_completed INTEGER NOT NULL DEFAULT 0 CHECK(auto_cycle_completed IN (0,1));
