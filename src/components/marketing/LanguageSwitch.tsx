import Link from "next/link";

export function LanguageSwitch({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      hrefLang={label === "EN" ? "en" : "es-MX"}
      className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold tracking-[0.14em] text-niebla transition hover:border-cian hover:text-cian"
      aria-label={label === "EN" ? "View in English" : "Ver en español"}
    >
      {label}
    </Link>
  );
}
