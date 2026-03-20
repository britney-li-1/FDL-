import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppBusProvider } from './state/app-bus'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBusProvider>
      <App />
    </AppBusProvider>
  </StrictMode>,
)
