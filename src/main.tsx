// SPDX-License-Identifier: AGPL-3.0-or-later
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './themes/tokens.css'
import './themes/base.css'
import './themes/layout.css'
import './themes/markdown.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
