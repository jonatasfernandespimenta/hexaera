import { useEffect, useState } from 'react'

const ID = crypto.randomUUID() // uma por aba; some ao fechar
const EVERY = 30_000

// Avisa o servidor que esta aba está jogando e devolve quantas abas estão ativas no total.
export function usePresence() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ID }) })
        .then(r => (r.ok ? r.json() : null)).then(d => d && setCount(d.count)).catch(() => {})
    }
    ping()
    const t = setInterval(ping, EVERY)
    document.addEventListener('visibilitychange', ping)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', ping) }
  }, [])
  return count
}
