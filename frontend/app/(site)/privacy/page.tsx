import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { getSettings, site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default async function Privacy() {
  const s = await getSettings();
  const contact = [s.email, s.phones[0]].filter(Boolean).join(" or ");
  return (
    <LegalPage
      title="Privacy Policy"
      custom={s.privacyText}
      defaults={[
        ["What we collect", `When you submit an enquiry, ${site.name} receives the details you provide: name, company, email, country, phone number, product interest, quantity, requirements, message and any file you attach.`],
        ["How we use it", "We use this information only to respond to your enquiry and to manage the resulting business relationship. We do not sell your data."],
        ["Who sees it", "Your enquiry is stored on our server and sent by email to our sales team. Attachments are not publicly accessible."],
        ["Analytics and cookies", "If analytics are enabled, they load only after you accept the consent banner, and you can decline. We do not use advertising cookies."],
        ["Retention", "We keep enquiries for as long as needed to handle your request and our business records."],
        ["Your rights", `You may ask us to access, correct or delete your information${contact ? ` by contacting us at ${contact}` : " using the contact details on this site"}.`],
      ]}
    />
  );
}
