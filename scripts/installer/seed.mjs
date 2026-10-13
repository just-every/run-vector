import branding from '../../src/branding.json' with { type: 'json' };
import { adapter, install } from './local.mjs';
export function createSeed() { return { ...adapter, product: branding.name, branding: { accent: branding.color }, theme: 'public/rer-theme.css', setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs', background: 'scripts/installer/ui/background.svg', install }; }
