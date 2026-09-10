import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Customer/Home";
import OrderForm from "./pages/Customer/OrderForm";
import OrderConfirmation from "./pages/Customer/OrderConfirmation";
import SendPayment from "./pages/Customer/SendPayment";
import AdminLogin from "./pages/Admin/Login";
import AdminDashboard from "./pages/Admin/Dashboard";

function ProtectedRoute({ children }) {
  const isAuth = !!sessionStorage.getItem("adminToken");
  return isAuth ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Customer */}
        <Route path="/" element={<Home />} />
        <Route path="/order" element={<OrderForm />} />
        <Route path="/order/done" element={<OrderConfirmation />} />
        <Route path="/pay" element={<SendPayment />} />
        <Route path="/pay/:orderId" element={<SendPayment />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}