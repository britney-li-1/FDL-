import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Layout from './layout/Layout'
import { AppBusProvider } from './state/app-bus'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBusProvider>
      <Layout />
    </AppBusProvider>
  </StrictMode>,
)
