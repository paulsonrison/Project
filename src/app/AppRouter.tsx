import { Navigate, Route, Routes } from "react-router";
import Home from "../pages/home";
import AboutUs from "../pages/AboutUs";
import ContactUs from "../pages/ContactUs";
import SignIn from "../pages/SignIn";
import Billing from "../pages/Billing";
import Calendar from "../pages/Calendar";
import DeliveryBoy from "../pages/DeliveryBoy";
import Settings from "../pages/Settings";
import Residents from "../pages/Residents";
import AppLayout from "../components/layout/AppLayout";

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/home" element={<Home />} />
      <Route path="/about-us" element={<AboutUs />} />
      <Route path="/contact-us" element={<ContactUs />} />
      <Route path="/signin" element={<SignIn />} />
      <Route element={<AppLayout />}>
        <Route path="/billing" element={<Billing />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/delivery-boy" element={<DeliveryBoy />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
};

export default AppRouter;
