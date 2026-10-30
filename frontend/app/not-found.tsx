import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <section className="container-page py-32 text-center lg:py-44">
      <p className="font-serif text-8xl italic text-brass lg:text-9xl">404</p>
      <h1 className="mt-6 font-heading text-title font-semibold">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-charcoal/70">The page you are looking for does not exist, has moved, or the product is no longer available.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-outline">Home</Link>
        <Link href="/products" className="btn btn-forest">Browse products <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </section>
  );
}
