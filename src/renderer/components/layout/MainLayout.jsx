import React from 'react'
import TitleBar from './TitleBar.jsx'

export default function MainLayout({ children }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Ana içeriğe geç</a>
      <TitleBar />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <div className="page-container">{children}</div>
      </main>
    </div>
  )
}
