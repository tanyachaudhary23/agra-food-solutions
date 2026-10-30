/** Shown instantly while the product list is fetched. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading products">
      <div className="mx-2 h-72 rounded-b-panel bg-forest sm:mx-3 lg:h-96" />
      <div className="container-page py-14">
        <div className="skeleton h-12 w-full max-w-xl rounded-full" />
        <div className="mt-8 flex gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-28 rounded-full" />)}</div>
        <div className="mt-14 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}><div className="skeleton aspect-[4/3] rounded-card" /><div className="skeleton mt-5 h-3 w-24 rounded-full" /><div className="skeleton mt-3 h-5 w-3/4 rounded-full" /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
