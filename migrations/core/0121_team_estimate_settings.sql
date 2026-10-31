-- Feature configuration never changes retained estimates or closed cycle snapshots.
ALTER TABLE teams ADD COLUMN estimates_enabled INTEGER NOT NULL DEFAULT 1 CHECK(estimates_enabled IN (0,1));
ALTER TABLE teams ADD COLUMN estimate_scale TEXT NOT NULL DEFAULT 'points' CHECK(estimate_scale IN ('points','fibonacci','exponential','tshirt'));
