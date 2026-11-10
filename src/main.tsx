import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'
import { iniciarTema } from './app/tema'
import { garantirPadrao } from './lib/db'

iniciarTema()
garantirPadrao()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
