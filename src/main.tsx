import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

applyGlobalStyles(rootElement)

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)

function applyGlobalStyles(root: HTMLElement) {
  const docStyle = document.documentElement.style
  docStyle.setProperty('font-family', 'system-ui, Avenir, Helvetica, Arial, sans-serif')
  docStyle.setProperty('line-height', '1.5')
  docStyle.setProperty('font-weight', '400')
  docStyle.setProperty('color', '#213547')
  docStyle.setProperty('background-color', '#ffffff')
  docStyle.setProperty('font-synthesis', 'none')
  docStyle.setProperty('text-rendering', 'optimizeLegibility')
  docStyle.setProperty('-webkit-font-smoothing', 'antialiased')
  docStyle.setProperty('-moz-osx-font-smoothing', 'grayscale')

  const bodyStyle = document.body.style
  bodyStyle.margin = '0'
  bodyStyle.display = 'flex'
  bodyStyle.minWidth = '320px'
  bodyStyle.minHeight = '100vh'
  bodyStyle.backgroundColor = '#ffffff'
  bodyStyle.color = '#213547'
  bodyStyle.fontFamily = 'system-ui, Avenir, Helvetica, Arial, sans-serif'
  bodyStyle.lineHeight = '1.5'
  bodyStyle.fontWeight = '400'
  bodyStyle.setProperty('place-items', 'center')

  Object.assign(root.style, {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '2rem',
    textAlign: 'center'
  })
}
