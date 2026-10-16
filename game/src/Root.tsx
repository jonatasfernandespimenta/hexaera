import { App } from './App'
import { Catalog } from './Catalog'

export function Root() {
  const catalog = new URLSearchParams(location.search).get('catalog')
  return catalog !== null && process.env.NODE_ENV === 'development' ? <Catalog filter={catalog} /> : <App />
}
