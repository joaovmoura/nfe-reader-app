import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: as rotas ficam depois do # (ex.: /nfe-reader-app/#/compras),
        porque o GitHub Pages não sabe redirecionar rotas de SPA. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
