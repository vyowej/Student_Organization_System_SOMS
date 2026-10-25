/**
 * Frontend Application Entry Point (src/main.jsx)
 *
 * Mounts the React root with BrowserRouter, global Toast notifications,
 * and shared CSS stylesheets for the UNIDOS / SOMS portal.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import './styles/polish.css'
import './styles/refine.css'
import './styles/facebook-layout.css'
// Keep the existing UI enhancement layer after legacy stylesheets.
import './ui-improvements.css'
import './design-system.css'
import './app-polish.css'
import { ToastProvider } from './components/ui/Toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
