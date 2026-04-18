import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { DocumentTitle } from "@/components/DocumentTitle";
import { ElectronMenuActions } from "@/components/ElectronMenuActions";
import NotFound from "./pages/NotFound";
import AppleKeyRotation from "./pages/AppleKeyRotation";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppSettingsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <DocumentTitle />
          <ElectronMenuActions />
          <Routes>
            <Route path="/" element={<AppleKeyRotation />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppSettingsProvider>
  </QueryClientProvider>
);

export default App;
