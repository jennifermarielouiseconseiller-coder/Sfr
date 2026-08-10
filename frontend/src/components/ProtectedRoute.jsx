import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }) => {
  const { user, ready } = useAuth();
  if (!ready)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};
