import { packageBuild as packageBaseBuild } from '../../vendor/base/deploy-kit/prepare.mjs';

/** Vector builds at the checkout root; the shared packer validates inert bytes. */
export function packageBuild(args) {
  return packageBaseBuild({ ...args, productDirectory: '' });
}
