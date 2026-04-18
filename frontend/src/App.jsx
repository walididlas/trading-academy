import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import { AcademyHome, ModulePage } from './pages/Academy'
import LessonPage from './pages/Lesson'
import Signals from './pages/Signals'
import Journal from './pages/Journal'
import Corrector from './pages/Corrector'
import Tools from './pages/Tools'
import Assistant from './pages/Assistant'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"                              element={<Dashboard />} />
          <Route path="/academy"                       element={<AcademyHome />} />
          <Route path="/academy/module/:moduleId"      element={<ModulePage />} />
          <Route path="/academy/module/:moduleId/lesson/:lessonId" element={<LessonPage />} />
          <Route path="/signals"                       element={<Signals />} />
          <Route path="/journal"                       element={<Journal />} />
          <Route path="/corrector"                     element={<Corrector />} />
          <Route path="/tools"                         element={<Tools />} />
          <Route path="/assistant"                     element={<Assistant />} />
          <Route path="*"                              element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
