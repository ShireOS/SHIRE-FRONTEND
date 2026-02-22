import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Detect if we're on the fake dashboard demo route
const isFakeDemo = window.location.pathname.startsWith('/fake-dashboard-demo')
const basename = isFakeDemo ? '/fake-dashboard-demo' : '/dashboard'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
