import { packageBuild as packageBaseBuild } from '@runeditrun/rer/internal/modules/deploy-kit/prepare.mjs';

/** Vector builds at the checkout root; the shared packer validates inert bytes. */
export function packageBuild(args) {
  return packageBaseBuild({ ...args, productDirectory: '' });
}
