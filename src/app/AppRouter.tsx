import { Navigate, Route, Routes } from "react-router";
import AppShell from '../features/workspace/AppShell';
import ChatView from '../features/workspace/ChatView';
import ComplaintsView from '../features/workspace/ComplaintsView';
import PricingEditor from '../features/workspace/PricingEditor';
import Dashboard from '../features/workspace/Dashboard';
import PreferencesPanel from '../features/settings/PreferencesPanel';
import { AboutScreen, ContactScreen, PublicHome, SignInScreen } from '../features/workspace/PublicScreens';
import { BillingScreen, DeliveryScreen, LedgerScreen, PausesScreen, ResidentsScreen, SettingsScreen, SubscriptionsScreen, ServicePoliciesScreen } from '../features/workspace/Screens';

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/home" element={<PublicHome />} />
      <Route path="/about-us" element={<AboutScreen />} />
      <Route path="/contact-us" element={<ContactScreen />} />
      <Route path="/signin" element={<SignInScreen />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/billing" element={<BillingScreen />} />
        <Route path="/calendar" element={<DeliveryScreen calendar />} />
        <Route path="/today" element={<DeliveryScreen />} />
        <Route path="/delivery-boy" element={<Navigate to="/today" replace />} />
        <Route path="/newspapers" element={<SettingsScreen />} />
        <Route path="/settings" element={<PreferencesPanel />} />
        <Route path="/service-policies" element={<ServicePoliciesScreen />} />
        <Route path="/residents" element={<ResidentsScreen />} />
        <Route path="/subscriptions" element={<SubscriptionsScreen />} />
        <Route path="/pauses" element={<PausesScreen />} />
        <Route path="/payments" element={<LedgerScreen />} />
        <Route path="/chat" element={<ChatView />} />
        <Route path="/complaints" element={<ComplaintsView />} />
        <Route path="/pricing" element={<PricingEditor />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};

export default AppRouter;
