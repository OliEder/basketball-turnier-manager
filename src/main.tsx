import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const redirect = sessionStorage.getItem('spa-redirect')
if (redirect !== null) {
  sessionStorage.removeItem('spa-redirect')
  const target = import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + redirect.replace(/^\//, '')
  window.history.replaceState(null, '', target)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
