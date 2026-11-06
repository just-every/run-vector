# Vector rulings

### RL-101 — AUTO-001 deferred after two lifetime FIX verdicts

Date: 6 November 2026. Ruler: CT. Clauses: AUTO-001 and AUTO-007.

AUTO-001 is DEFER after two lifetime FIX verdicts: twoFIX, reopenfalse. Neither original source `352cadb54aad54198b16ba0c245079555d7d923a` nor corrected source `133901fe0c6b727a95df326dfbf2d3b58869ca45` lands as gated. Its original scope, Status, complete Gap/Evidence, frozen checks and two-FIX history stay intact; this ruling does not reopen it or authorize a third repair.

The original gate found missing Settings controls (A) and private previous-occurrence status disclosure (B). The required independent Opus gate returned FIX1 on `133901fe0c6b727a95df326dfbf2d3b58869ca45`: A was resolved; the same B reproduced through scheduled/native doors and Settings at 1440/390. A Member receives issue GET 404, but series history says skipped while the moved private issue is open, then created after its completion. That is introduced privacy exposure, absent on main, and remains the same B rather than a third new blocker. The lifetime two-FIX cap is exhausted; SD takes another buildable clause.

AUTO-007 formalizes one new privacy capability for the next planned Vector round. It starts missing with empty Evidence; `docs/contract/AUTO-007-rubric.md` freezes requirements for that future build and supplies no passing evidence or source acceptance. All 272 original definitions and their full Status/Gap/Evidence, provenance, newer assertions and homepage claim remain unchanged; only Missing and total increase by one.

The original deployment-inventory notes, 0126 migration collision and CI failures are provenance only, not tooling-repair instructions or proof transferable to this contract pass. The qualified additive-generator prerequisite landing supersedes only the prior generator dependency. Existing source, stack, review, provider, production and release holds remain. The continuation's supported CT review hold stays installed pending independent Opus review of its exact candidate head; no hold is released and no DONE or landing is awarded here.
