/** A template (unlike a layout) is re-created on every navigation, which gives each page a quiet fade-and-rise entrance. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
