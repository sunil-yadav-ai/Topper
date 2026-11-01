import { Link } from "react-router-dom";

export default function AuthLayout({ children, eyebrow, title, description }) {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 px-4 py-6 sm:px-6 sm:py-10">
      <header className="mx-auto w-full max-w-6xl">
        <Link className="inline-flex items-center rounded-xl text-xl font-extrabold tracking-tight text-ink" to="/">
          Study<span className="text-brand">Share</span>
        </Link>
      </header>
      <div className="mx-auto my-auto w-full max-w-6xl py-8 sm:py-10">
        <div className="grid overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_32px_80px_-48px_rgba(30,41,59,0.35)] md:grid-cols-[0.9fr_1.1fr]">
          <aside className="hidden flex-col justify-between bg-gradient-to-br from-ink via-[#1e2b61] to-indigo-800 p-10 text-white md:flex lg:p-14">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-300">
                StudyShare
              </p>
              <h2 className="mt-8 text-3xl font-bold leading-tight">
                Your next great study session starts here.
              </h2>
              <p className="mt-4 leading-7 text-indigo-100/80">
                Discover and share the academic resources that help your campus
                community learn together.
              </p>
            </div>
            <p className="text-sm text-indigo-200/70">
              A learning community built for students.
            </p>
          </aside>
          <section className="p-6 sm:p-10 lg:p-14">
            {eyebrow && (
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            )}
            <div className="mt-7">{children}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
