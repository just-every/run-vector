import { stat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const text = value => typeof value === 'string' && value.trim().length > 0;

// Descriptors can identify only files in their own checkout, including through symlinks.
async function localFile(root, path) {
  if (!text(path) || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error('Invalid project input path.');
  const target = await realpath(resolve(root, path));
  const inside = relative(await realpath(root), target);
  if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('Project input escapes checkout.');
  if (!(await stat(target)).isFile()) throw new Error('Project input is not a file.');
}

export async function readProjectOperations(root, descriptor) {
  if (!text(descriptor.project) || !Array.isArray(descriptor.requiredEnvironment)
      || descriptor.requiredEnvironment.some(name => typeof name !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(name))
      || !Array.isArray(descriptor.runtime?.requirements)
      || descriptor.runtime.requirements.some(item => !text(item?.name) || !text(item?.version))
      || !descriptor.commands || Array.isArray(descriptor.commands)
      || !Object.keys(descriptor.commands).length) throw new Error('Invalid project operations descriptor.');
  for (const path of [descriptor.documentation?.document, descriptor.acceptance?.document, descriptor.configuration?.module].filter(value => value !== undefined)) await localFile(root, path);
  const commands = [];
  for (const [name, command] of Object.entries(descriptor.commands)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !Array.isArray(command?.argv) || !command.argv.length
        || command.argv.some(arg => typeof arg !== 'string') || !text(command.argv[0])
        || !text(command.effects) || !Array.isArray(command.inputs)) throw new Error('Invalid project operation command.');
    let available = true;
    for (const path of command.inputs) {
      // Malformed paths are descriptor errors; missing declared files are unavailable targets.
      if (!text(path) || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error('Invalid project input path.');
      try { await localFile(root, path); } catch (error) {
        if (error.code === 'ENOENT') available = false;
        else throw error;
      }
    }
    commands.push({ name, available });
  }
  return { descriptor, commands };
}

/** Declarative local loop checks. Never imports a module, sends mail, queries DNS or invokes a command. */
export function inspectRequiredLoops(descriptor, env) {
  const loops = descriptor.loops ?? [];
  if (!Array.isArray(loops) || new Set(loops.map(loop => loop?.id)).size !== loops.length) throw new Error('Invalid loop declarations.');
  return loops.map(loop => {
    if (!loop || typeof loop.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(loop.id) || typeof loop.required !== 'boolean' || typeof loop.enabled !== 'boolean' || !['worker', 'mail'].includes(loop.type)) throw new Error('Invalid loop declaration.');
    const missingEnvironment = []; let status = 'ready';
    if (!loop.enabled) status = loop.required ? 'disabled-required' : 'optional-disabled';
    else if (loop.type === 'mail') {
      const provider = loop.provider;
      if (!['sendgrid','resend','cloudflare'].includes(provider)) status = 'invalid-mail-provider';
      else {
        const key = {sendgrid:'SENDGRID_API_KEY',resend:'RESEND_API_KEY',cloudflare:'CLOUDFLARE_EMAIL_API_TOKEN'}[provider];
        if (typeof env[key] !== 'string' || !env[key].trim()) missingEnvironment.push(key);
        if (provider === 'cloudflare' && !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_EMAIL_ACCOUNT_ID ?? '')) missingEnvironment.push('CLOUDFLARE_EMAIL_ACCOUNT_ID');
        if (missingEnvironment.length) status = 'missing-inputs';
        if (env.MAIL_PROVIDER && env.MAIL_PROVIDER !== provider) status = 'mail-provider-mismatch';
      }
    } else if (loop.type !== 'worker') throw new Error('Invalid loop type.');
    return {id:loop.id,required:loop.required,status,missingEnvironment};
  });
}
