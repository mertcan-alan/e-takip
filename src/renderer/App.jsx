import React from 'react'
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { PrescriptionProvider } from './context/PrescriptionContext.jsx'
import MainLayout from './components/layout/MainLayout.jsx'
import Toast from './components/ui/Toast.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Prescriptions from './pages/Prescriptions.jsx'
import Analytics from './pages/Analytics.jsx'
import Reports from './pages/Reports.jsx'
import Patients from './pages/Patients.jsx'
import NewPrescription from './pages/NewPrescription.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import Login from './pages/Login.jsx'

function AuthenticatedApplication() {
  return (
    <PrescriptionProvider>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/prescriptions/new" element={<NewPrescription />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MainLayout>
    </PrescriptionProvider>
  )
}

function ApplicationRoutes() {
  const { isAuthenticated } = useApp()

  return (
    <>
      <Toast />
      {isAuthenticated ? (
        <AuthenticatedApplication />
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </>
  )
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <ApplicationRoutes />
      </AppProvider>
    </Router>
  )
}
