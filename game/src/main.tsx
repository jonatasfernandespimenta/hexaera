import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Catalog } from './Catalog'
import './style.css'

const catalog = new URLSearchParams(location.search).get('catalog')
createRoot(document.getElementById('root')!).render(catalog !== null && import.meta.env.DEV ? <Catalog filter={catalog} /> : <App />)
