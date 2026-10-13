import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../core/app/site/home/home-page'
import { hero, meta } from '../core/app/site/home/copy/hero'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: `Vector — ${hero.title}` },
      { name: 'description', content: meta.description },
    ],
  }),
  component: HomePage,
})
