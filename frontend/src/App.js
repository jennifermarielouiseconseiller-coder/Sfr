import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ForgotIdentifier from "@/pages/ForgotIdentifier";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import Payment from "@/pages/Payment";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/identifiant-oublie" element={<ForgotIdentifier />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/factures"
              element={
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/paiement/:id"
              element={
                <ProtectedRoute>
                  <Payment />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </div>
  );
}

export default App;
