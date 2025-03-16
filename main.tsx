import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { register as registerServiceWorker } from './utils/serviceWorkerRegistration'

// Immediately log for troubleshooting
console.log('main.tsx is executing')

// Function to safely mount the app
function mountApp() {
  try {
    const rootElement = document.getElementById('root')
    
    // Log element details
    console.log('Root element found:', rootElement)
    
    if (!rootElement) {
      console.error('Root element not found in the document')
      return
    }
    
    // Create root and render
    const root = createRoot(rootElement)
    
    console.log('Root created, rendering app...')
    
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
    
    console.log('Render method called')
  } catch (error) {
    console.error('Error mounting React app:', error)
  }
}

// Execute mounting
mountApp()

// Register service worker for offline functionality
registerServiceWorker()
