import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { OrganizationProvider } from './contexts/OrganizationContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import RequireAuth from './components/auth/RequireAuth'
import DashboardLayout from './components/layout/DashboardLayout'
import Home from './pages/Home'
import ForgotPassword from './pages/auth/ForgotPassword'
import Onboarding from './pages/Onboarding'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="ui-theme">
        <ToastProvider>
          <Router>
            <OrganizationProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Home />} />
                <Route path="/sign-in" element={<Home />} />
                <Route path="/sign-up" element={<Home />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Protected routes with dashboard layout */}
                <Route
                  path="/onboarding"
                  element={
                    <RequireAuth>
                      <Onboarding />
                    </RequireAuth>
                  }
                />

                {/* Dashboard routes */}
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div className="space-y-6">
                          <div>
                            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                            <p className="text-muted-foreground">
                              Welcome to your status page dashboard
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg border bg-card p-6">
                              <h3 className="text-sm font-medium">Total Services</h3>
                              <p className="text-2xl font-bold">12</p>
                            </div>
                            <div className="rounded-lg border bg-card p-6">
                              <h3 className="text-sm font-medium">Active Incidents</h3>
                              <p className="text-2xl font-bold">2</p>
                            </div>
                            <div className="rounded-lg border bg-card p-6">
                              <h3 className="text-sm font-medium">Uptime</h3>
                              <p className="text-2xl font-bold">99.9%</p>
                            </div>
                            <div className="rounded-lg border bg-card p-6">
                              <h3 className="text-sm font-medium">Response Time</h3>
                              <p className="text-2xl font-bold">245ms</p>
                            </div>
                          </div>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/services"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Services</h1>
                          <p className="text-muted-foreground">Manage your services and their status</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/incidents"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Incidents</h1>
                          <p className="text-muted-foreground">Track and manage incidents</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/maintenance"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
                          <p className="text-muted-foreground">Schedule and manage maintenance windows</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/analytics"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                          <p className="text-muted-foreground">Service performance and incident analytics</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/team"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
                          <p className="text-muted-foreground">Manage team members and permissions</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/user-profile"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                          <p className="text-muted-foreground">Manage your profile settings</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                          <p className="text-muted-foreground">General settings and preferences</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/organization/settings"
                  element={
                    <RequireAuth>
                      <DashboardLayout>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
                          <p className="text-muted-foreground">Organization settings and configuration</p>
                        </div>
                      </DashboardLayout>
                    </RequireAuth>
                  }
                />
              </Routes>
            </OrganizationProvider>
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
