// Lê `location`: só pode carregar no cliente (importado com ssr:false em app/page.tsx)
import { useEffect, useState } from 'react'
import { App } from './App'
import { Catalog } from './Catalog'
import { initAds } from './ads'

export function Root() {
  const [ready, setReady] = useState(false)
  useEffect(() => { initAds().then(() => setReady(true)) }, [])
  if (!ready) return null
  const catalog = new URLSearchParams(location.search).get('catalog')
  return catalog !== null && process.env.NODE_ENV === 'development' ? <Catalog filter={catalog} /> : <App />
}
