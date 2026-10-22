/**
 * Imagotipo placeholder de Café Nómada: brújula con una moka al centro y dos granos.
 * Es vectorial y reemplazable: cuando exista el archivo oficial de marca, sustituir
 * este componente y `public/brand/logo.svg` sin cambiar su interfaz.
 */
type LogoMarkProps = {
  className?: string;
  /** Si es decorativo (acompañado de texto visible) se oculta a lectores de pantalla. */
  decorative?: boolean;
};

export function LogoMark({ className, decorative = true }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "Café Nómada"}
      fill="none"
    >
      <circle cx="32" cy="32" r="30" fill="#3D2C24" />
      <circle cx="32" cy="32" r="25.5" stroke="#D48C46" strokeWidth="1.2" strokeDasharray="1.5 3" />
      {/* Puntas de la brújula */}
      <path d="M32 3.5 34.2 10h-4.4L32 3.5ZM32 60.5 29.8 54h4.4L32 60.5ZM3.5 32 10 29.8v4.4L3.5 32ZM60.5 32 54 34.2v-4.4l6.5 2.2Z" fill="#D48C46" />
      {/* Moka */}
      <path d="M26 21h12l-1.6 5.5h-8.8L26 21Z" fill="#F5EBE6" />
      <path d="M27.6 26.5h8.8l-1 3h-6.8l-1-3Z" fill="#A65D46" />
      <path d="M28.6 29.5h6.8l3.1 13.5H25.5l3.1-13.5Z" fill="#F5EBE6" />
      <path d="M38.2 31.5c3 .3 4.3 2.2 4.1 4.6-.2 2.2-1.7 3.5-3.5 3.9" stroke="#F5EBE6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30.5 18.5h3" stroke="#F5EBE6" strokeWidth="1.8" strokeLinecap="round" />
      {/* Granos */}
      <g fill="#D48C46">
        <ellipse cx="21" cy="46" rx="3.1" ry="2.1" transform="rotate(-28 21 46)" />
        <ellipse cx="43" cy="46" rx="3.1" ry="2.1" transform="rotate(28 43 46)" />
      </g>
      <path d="M19.4 46.9c1-.4 2.2-1.3 3-2.2M44.6 46.9c-1-.4-2.2-1.3-3-2.2" stroke="#3D2C24" strokeWidth=".8" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark className="h-10 w-10 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-[0.12em]">CAFÉ NÓMADA</span>
        <span className="bitacora mt-1 hidden text-[0.6rem] opacity-75 sm:block">Café de origen · alma de viajero</span>
      </span>
    </span>
  );
}
