import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import ConsentAnalytics from "@/components/ConsentAnalytics";
import { QuoteListProvider } from "@/components/QuoteList";
import CatalogueMemory from "@/components/CatalogueMemory";
import WhatsAppButton from "@/components/WhatsAppButton";

// Content comes from the backend, so pages are rendered on request (API responses are cached for 30 seconds).
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuoteListProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-brass focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header />
      <CatalogueMemory />
      <main id="main">{children}</main>
      <Footer />
      <WhatsAppButton />
      <Reveal />
      <ConsentAnalytics />
    </QuoteListProvider>
  );
}
