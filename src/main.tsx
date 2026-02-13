import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ExpLanding from './ExpLanding.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExpLanding />
  </StrictMode>,
)
