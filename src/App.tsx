import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";

/** BrowserRouter uses the real URL path; with `loadFile()` that is a `file://` path, not `/`. HashRouter keeps routes in the hash so Electron production loads `/` correctly. */
const Router =
  import.meta.env.VITE_ELECTRON === "true" ? HashRouter : BrowserRouter;
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
        <Router>
          <DocumentTitle />
          <ElectronMenuActions />
          <Routes>
            <Route path="/" element={<AppleKeyRotation />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </AppSettingsProvider>
  </QueryClientProvider>
);

export default App;
