import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { shouldUseHashRouter } from "@/lib/isElectronApp";
import { KvPersistenceProvider } from "@/contexts/KvPersistenceContext";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { InAppNotificationsProvider } from "@/contexts/InAppNotificationsContext";
import { DocumentTitle } from "@/components/DocumentTitle";
import { ElectronMenuActions } from "@/components/ElectronMenuActions";
import NotFound from "./pages/NotFound";
import AppleKeyRotation from "./pages/AppleKeyRotation";
import Settings from "./pages/Settings";
import NotificationHistory from "./pages/NotificationHistory";

const queryClient = new QueryClient();

const App = () => {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter;

  return (
  <QueryClientProvider client={queryClient}>
    <KvPersistenceProvider>
      <AppSettingsProvider>
        <InAppNotificationsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Router>
              <DocumentTitle />
              <ElectronMenuActions />
              <Routes>
                <Route path="/" element={<AppleKeyRotation />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/notifications" element={<NotificationHistory />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Router>
          </TooltipProvider>
        </InAppNotificationsProvider>
      </AppSettingsProvider>
    </KvPersistenceProvider>
  </QueryClientProvider>
  );
};

export default App;
