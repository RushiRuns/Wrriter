import React from 'react'

export function App(): React.JSX.Element {
  const handleMinimize = (): void => {
    window.wrriter?.window.minimize()
  }

  const handleMaximize = (): void => {
    window.wrriter?.window.maximize()
  }

  const handleClose = (): void => {
    window.wrriter?.window.close()
  }

  return (
    <div className="window-shell">
      <header className="window-toolbar">
        <div className="toolbar-title">Wrriter</div>
        <div className="window-controls">
          <button
            type="button"
            className="window-btn window-btn-minimize"
            onClick={handleMinimize}
            aria-label="Minimize"
          />
          <button
            type="button"
            className="window-btn window-btn-maximize"
            onClick={handleMaximize}
            aria-label="Maximize"
          />
          <button
            type="button"
            className="window-btn window-btn-close"
            onClick={handleClose}
            aria-label="Close"
          />
        </div>
      </header>
      <main className="window-body">
        {/* Empty window shell - features start in M1 */}
      </main>
    </div>
  )
}
