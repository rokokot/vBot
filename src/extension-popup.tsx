// src/extension-popup.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ExtensionPopup from './extension/ExtensionPopup'

// Initialize the extension popup
const container = document.getElementById('extension-root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ExtensionPopup />
    </StrictMode>,
  )
}