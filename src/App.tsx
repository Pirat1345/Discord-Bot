import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import InitialSetup from "@/pages/InitialSetup";
import Dashboard from "@/pages/Dashboard";
import BotControl from "@/pages/BotControl";
import Games from "@/pages/Games";
import {
  SettingsConfigurationDiscord,
  SettingsConfigurationGeneral,
  SettingsHome,
  SettingsProfile,
  SettingsUsers,
} from "@/pages/SettingsPages";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<InitialSetup />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/discord" element={<BotControl />} />
              <Route path="/games" element={<Games />} />
              <Route path="/bot" element={<Navigate to="/discord" replace />} />
              <Route path="/settings" element={<SettingsHome />} />
              <Route path="/settings/profile" element={<SettingsProfile />} />
              <Route path="/settings/users" element={<SettingsUsers />} />
              <Route path="/settings/configuration" element={<Navigate to="/settings/configuration/general" replace />} />
              <Route path="/settings/configuration/general" element={<SettingsConfigurationGeneral />} />
              <Route path="/settings/configuration/discord" element={<SettingsConfigurationDiscord />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
