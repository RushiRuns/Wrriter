import React from 'react'
import { createRoot } from 'react-dom/client'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <div>Wrriter</div>
    </React.StrictMode>
  )
}
