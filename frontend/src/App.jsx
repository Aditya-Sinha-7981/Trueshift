import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import Login from "./pages/Login"
import Register from "./pages/Register"
import PendingVerification from "./pages/PendingVerification"
import EmployeeDashboard from "./pages/EmployeeDashboard"
import AdminDashboard from "./pages/AdminDashboard"
import CheckIn from "./pages/CheckIn"
import ApplyLeave from "./pages/ApplyLeave"
import LeaveManagement from "./pages/LeaveManagement"
import EmployeeManagement from "./pages/EmployeeManagement"
import EmployeeProfile from "./pages/EmployeeProfile"
import GeofenceManagement from "./pages/GeofenceManagement"
import Holidays from "./pages/Holidays"
import Reports from "./pages/Reports"

function HomeRedirect() {
  const token = localStorage.getItem("auth_token")
  const role = localStorage.getItem("user_role")
  if (!token) return <Navigate to="/login" replace />
  if (["admin", "super_admin"].includes(role)) return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

function RequireAuth({ children }) {
  const token = localStorage.getItem("auth_token")
  return token ? children : <Navigate to="/login" replace />
}

function RequireEmployee({ children }) {
  const token = localStorage.getItem("auth_token")
  const role = localStorage.getItem("user_role")
  if (!token) return <Navigate to="/login" replace />
  if (role !== "employee") return <Navigate to="/admin" replace />
  return children
}

function RequireAdmin({ children }) {
  const role = localStorage.getItem("user_role")
  if (!localStorage.getItem("auth_token")) return <Navigate to="/login" replace />
  if (!["admin", "super_admin"].includes(role)) return <Navigate to="/dashboard" replace />
  return children
}

function RequireSuperAdmin({ children }) {
  const role = localStorage.getItem("user_role")
  if (!localStorage.getItem("auth_token")) return <Navigate to="/login" replace />
  if (role !== "super_admin") return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<PendingVerification />} />

        <Route
          path="/dashboard"
          element={
            <RequireEmployee>
              <EmployeeDashboard />
            </RequireEmployee>
          }
        />
        <Route
          path="/checkin"
          element={
            <RequireAuth>
              <CheckIn />
            </RequireAuth>
          }
        />
        <Route
          path="/apply-leave"
          element={
            <RequireEmployee>
              <ApplyLeave />
            </RequireEmployee>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <RequireAdmin>
              <EmployeeManagement />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/employees/:id"
          element={
            <RequireAdmin>
              <EmployeeProfile />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/leaves"
          element={
            <RequireAdmin>
              <LeaveManagement />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/geofence"
          element={
            <RequireSuperAdmin>
              <GeofenceManagement />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="/admin/holidays"
          element={
            <RequireSuperAdmin>
              <Holidays />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireAdmin>
              <Reports />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
