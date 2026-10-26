import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-page py-32 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-charcoal/75">The page you are looking for does not exist or has moved.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="btn btn-outline">Home</Link>
        <Link href="/products" className="btn btn-forest">Browse products</Link>
      </div>
    </section>
  );
}
