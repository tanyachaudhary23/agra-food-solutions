import { seedCatalogueIfEmpty, ensureAdmin } from "./seed.js";

console.log(seedCatalogueIfEmpty() ? "Catalogue loaded." : "Database already has data; nothing to seed.");
ensureAdmin();
