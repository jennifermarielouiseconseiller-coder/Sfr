import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import Verification from "@/pages/Verification";
import ForgotPassword from "@/pages/ForgotPassword";
import ForgotIdentifier from "@/pages/ForgotIdentifier";
import ResetPassword from "@/pages/ResetPassword";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Payment from "@/pages/Payment";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/verification" replace />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/login" element={<Navigate to="/verification" replace />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/identifiant-oublie" element={<ForgotIdentifier />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/factures/:id"
              element={
                <ProtectedRoute>
                  <InvoiceDetail />
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
            <Route path="*" element={<Navigate to="/verification" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </div>
  );
}

export default App;
