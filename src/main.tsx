import React from 'react'
import ReactDOM from 'react-dom/client'
// Side-effect import: fires /me, /seasons, /teams in parallel as soon as
// possible. Must be imported before App so the requests are in flight by
// the time the contexts mount.
import './lib/bootPrefetch'
import App from './App.tsx'
import './styles/globals.css'
import { ThemeProvider } from './contexts/ThemeContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)