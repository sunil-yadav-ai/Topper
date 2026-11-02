export function PageLoader({ label = "Getting your study space ready…" }) {
  return (
    <div aria-busy="true" aria-live="polite" className="ed-page-loader" role="status">
      <span aria-hidden="true" className="ed-loader-book">
        <i /><i />
      </span>
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, icon = "book", className = "" }) {
  return (
    <section className={`ed-empty-state ${className}`} data-ed-animate>
      <span aria-hidden="true" className={`ed-empty-illustration ed-empty-${icon}`}>
        {icon === "paper" ? (
          <svg fill="none" viewBox="0 0 64 72">
            <path d="M12 5h27l14 14v46H12z" fill="#fff9ec" stroke="currentColor" strokeLinejoin="round" strokeWidth="3" />
            <path d="M39 5v15h14M21 33h23M21 41h23M21 49h15" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
            <path d="m8 25-3 3m51 16 4 2" stroke="#ff6b24" strokeLinecap="round" strokeWidth="3" />
          </svg>
        ) : (
          <svg fill="none" viewBox="0 0 72 64">
            <path d="M7 16c10-4 19-3 29 3v36c-10-6-19-7-29-3V16Zm58 0c-10-4-19-3-29 3v36c10-6 19-7 29-3V16Z" fill="#fff9ec" stroke="currentColor" strokeLinejoin="round" strokeWidth="3" />
            <path d="M13 25c6-2 12-1 17 2M13 33c6-2 12-1 17 2m25-10c-6-2-12-1-17 2m17 6c-6-2-12-1-17 2" stroke="#9270e8" strokeLinecap="round" strokeWidth="3" />
            <path d="m36 4 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#ff6b24" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        )}
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </section>
  );
}
