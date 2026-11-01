export default function Button({
  children,
  className = "",
  variant = "primary",
  as: Component = "button",
  ...props
}) {
  const variants = {
    primary: "bg-brand text-white shadow-sm shadow-indigo-950/10 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md",
    secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-brand",
  };

  return (
    <Component
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
