// SPDX-License-Identifier: AGPL-3.0-or-later
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './themes/tokens.css'
import './themes/base.css'
import './themes/layout.css'
import './themes/markdown.css'
import './themes/macos.css'
import { isDesktopApp } from './desktop/tauri'

// Keep the native webview opaque: the glass is composited inside the app.
if (isDesktopApp() && /Macintosh|Mac OS X/.test(navigator.userAgent)) {
  document.documentElement.dataset.macGlass = 'true'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
