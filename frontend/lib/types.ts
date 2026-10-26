export type Category = { slug: string; name: string; description: string };

export type Product = {
  id: number;
  code: string;
  slug: string;
  name: string;
  category: string; // category slug
  categoryName: string;
  shortDescription: string;
  fullDescription: string;
  images: { src: string; alt: string }[];
  specifications: { label: string; value: string }[];
  applications: string[];
  industries: string[]; // industry slugs, see lib/site.ts
  compatibility: string[];
  variants: string[];
  documents: { label: string; href: string }[];
  featured: boolean;
  status: "published" | "draft";
  seoTitle: string;
  seoDescription: string;
};

export type Settings = {
  email: string;
  phones: string[];
  landline: string;
  whatsapp: string;
  factoryAddress: string;
  registeredOffice: string;
  cin: string;
  gst: string;
  iec: string;
  established: string;
  aboutStory: string;
  certifications: string[];
  exportRegions: string;
  incoterms: string;
  paymentTerms: string;
  exportDocumentation: string;
  minimumOrder: string;
  enquiryRecipient: string;
  social: { linkedin: string; facebook: string; instagram: string; youtube: string };
  privacyText: string;
  termsText: string;
};
