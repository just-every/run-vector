import { scopedSurface, refusalPhase } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/subset.mjs';
import { randomUUID } from 'node:crypto';
import { createProtocol } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/protocol.mjs';
import { autonomousPolicy, heldPolicy } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/crypto.mjs';
import { discoverDoor, listedDoor } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/discovery.mjs';
import { runJourney } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/journey.mjs';
import { unsetPolicy, removalPhase, blockedPhases, pausePhase, consentRevocationPhase } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/policy-phases.mjs';
import { negativePhase } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/negative.mjs';
import { invocationPhase } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/invocation.mjs';
import { replayAdmissionPhase } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/replay.mjs';
import { auditPhase } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/audit.mjs';

/** Run the pinned Base phases on the full real registry even when a declaration
 * is pending. The caller prints every declaration and retains its failure exit;
 * this gives runtime results instead of stopping at the declaration gate. All
 * assertions and native journey calls remain the installed CLI's actual implementations. */
export async function runNativePhases({ fetch, invoke, origin, surface, signer, person }) {
  surface = scopedSurface(surface);
  const points = [];
  const c = createProtocol({ fetch, origin, surface, signer, person, business: 'rer-agent-conformance',
    consent: randomUUID(), agentId: `rer-conformance-${randomUUID()}`, seq: 0, revision: 0, listed: new Map(), points });
  // Unproved lifecycle calls remain failed declarations. Negative admission
  // phases can still check every registered tool with inert arguments, just
  // as Base uses unresolved record references before policy is available.
  const negativeSurface = { ...surface, journey: [...surface.journey,
    ...surface.tools.filter(tool => !surface.journey.some(step => step.tool === tool.name))
      .map(tool => ({ id: 'pending-lifecycle-' + tool.name, tool: tool.name, args: {} }))] };
  const negative = async run => {
    c.surface = negativeSurface;
    try { await run(); } finally { c.surface = surface; }
  };
  await c.phase('BASE-AGENT-001.transport', () => discoverDoor(c));
  await c.phase('BASE-AGENT-007.phase0', () => negative(() => unsetPolicy(c, true)));
  await c.phase('BASE-AGENT-007.phase1', () => negative(() => removalPhase(c)));
  await c.phase('BASE-AGENT-013.phase2', async () => { await c.adopt(autonomousPolicy()); await listedDoor(c); await runJourney(c, 'autonomous', { injections: true, replay: true }); });
  await c.phase('BASE-AGENT-013.phase3', async () => { await c.adopt(heldPolicy()); await runJourney(c, 'held', { held: true }); });
  await c.phase('BASE-AGENT-007.phase4', () => blockedPhases(c));
  await c.phase('BASE-AGENT-011.phase5', () => negative(() => pausePhase(c)));
  await c.phase('BASE-AGENT-004.phase6', () => negativePhase(c));
  await c.phase('BASE-AGENT-004.consent', () => consentRevocationPhase(c));
  await c.phase('BASE-AGENT-012.invocation', () => invocationPhase(c, invoke));
  if (surface.verification?.replayAdmission) await c.phase('BASE-AGENT-012.replay', () => replayAdmissionPhase(c, surface.verification.replayAdmission));
  await c.phase('BASE-AGENT-subset.refusals', () => refusalPhase(c));
  await c.phase('BASE-AGENT-009.phase7', () => auditPhase(c));
  return { ok: points.every(point => point.ok), points };
}
