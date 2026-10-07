import { runSendGridConformance } from './conformance.mjs';
// Test-only workerd entry. No Node imports or external provider calls.
export default { async fetch() { return Response.json(await runSendGridConformance()); } };
