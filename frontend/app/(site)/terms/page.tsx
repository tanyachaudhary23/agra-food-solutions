import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { getSettings, site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/terms" } };

export default async function Terms() {
  const s = await getSettings();
  return (
    <LegalPage
      title="Terms of Use"
      custom={s.termsText}
      defaults={[
        ["Information on this site", `Content on this website is provided for general information about ${site.name}. Product listings are not offers; availability, specifications and prices are confirmed in a written quotation.`],
        ["Enquiries", "Submitting an enquiry does not create a contract. Commercial terms apply only once agreed in writing."],
        ["Images and specifications", "Pictures are for illustration. Actual dimensions, materials and finish are confirmed in the quotation."],
        ["Intellectual property", "Text, images and the design of this website belong to the company or its licensors and may not be copied without permission."],
      ]}
    />
  );
}
