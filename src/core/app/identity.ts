import type { EditionIdentity } from '../../base/identity'
import { productConfig } from '../../ext/config'
import { hero } from './site/home/copy/hero'
import site from '../../../deploy-site.json'

// Edition data only. The installed Worker supplies WORKSPACE_NAME separately;
// the static site never imports or reads an installation's settings.
export const identity: EditionIdentity = {
  product: productConfig.productName,
  deployment: productConfig.productName,
  purpose: '{deployment} keeps issues, decisions and work in one private workspace.',
  tagline: hero.title,
  signInPath: '/signin',
  runSite: `https://${site.domain}`,
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  band: '/brand/band.svg',
  fonts: '/fonts/fonts.css',
}
