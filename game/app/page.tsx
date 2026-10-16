'use client'
import dynamic from 'next/dynamic'

const Root = dynamic(() => import('../src/Root').then(m => m.Root), { ssr: false })

export default function Page() {
  return <Root />
}
