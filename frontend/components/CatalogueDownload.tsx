import { Download } from "lucide-react";
import { API_URL } from "@/lib/api";

export const CATALOGUE_URL = `${API_URL}/api/catalogue.pdf`;

/** Link to the catalogue PDF, which the backend builds from the current published products. */
export default function CatalogueDownload({ className = "btn btn-outline", label = "Download catalogue (PDF)" }: { className?: string; label?: string }) {
  return (
    <a href={CATALOGUE_URL} className={className} download="Agra-Food-Solutions-Catalogue.pdf">
      <Download size={16} aria-hidden /> {label}
    </a>
  );
}
