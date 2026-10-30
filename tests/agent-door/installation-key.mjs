import { randomBytes } from 'node:crypto';

/** Fresh custody for this disposable verifier Worker; never persisted or logged. */
export default () => randomBytes(32).toString('hex');
