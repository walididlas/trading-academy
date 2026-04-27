import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import BottomNav from './BottomNav'
import AlertToast from '../AlertToast'
import PushBanner from '../PushBanner'
import { AlertProvider } from '../../contexts/AlertContext'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate  = useNavigate()

  // SW → app navigation: notification tap sends ta_navigate when app is already open
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (e) => {
      if (e.data?.type === 'ta_navigate' && e.data.url) {
        navigate(e.data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Close sidebar on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <AlertProvider>
      <div className="app-shell">
        {/* Desktop sidebar — always visible on wide screens */}
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />

        {/* Mobile overlay — dims content when sidebar open */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Right side: header + scrollable content + bottom nav */}
        <div className="app-main">
          {/* Mobile-only top header */}
          <MobileHeader onMenuOpen={openSidebar} />

          {/* Push notification opt-in banner — shown until subscribed */}
          <PushBanner />

          {/* In-app alert toasts (appear below mobile header) */}
          <AlertToast />

          {/* Page content */}
          <main className="app-content">
            {children}
          </main>
        </div>

        {/* Mobile-only bottom nav */}
        <BottomNav />
      </div>
    </AlertProvider>
  )
}
