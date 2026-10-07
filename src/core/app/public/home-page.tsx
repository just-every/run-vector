import { Link } from '@tanstack/react-router'
import { productConfig } from '../config'
import { PublicFrame } from './public-frame'

export function HomePage() {
  return (
    <PublicFrame variant="portal">
      <div aria-labelledby="owner-name">
        <h1 id="owner-name">Welcome to<br />{productConfig.ownerName}</h1>
        <p className="owner-statement">{productConfig.ownerStatement}</p>
        <Link className="primary-action" to="/signin">
          Sign in <span aria-hidden="true">→</span>
        </Link>
      </div>
    </PublicFrame>
  )
}
