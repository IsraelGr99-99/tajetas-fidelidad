import Image from "next/image";

export function ProductThumbnail({ src, size = 80 }: { src: string | null; size?: number }) {
  return src ? <Image src={src} alt="" width={size} height={size} unoptimized
    className="shrink-0 rounded-xl border border-[#eee2d5] object-cover" style={{ width: size, height: size }} />
    : <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-xl border border-[#ecd9bd] bg-gradient-to-br from-[#fff9ed] via-[#f8e5c8] to-[#edc999] text-[#815430]"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 24h32v15a12 12 0 0 1-12 12h-8a12 12 0 0 1-12-12V24Z" />
        <path d="M47 28h4a6 6 0 0 1 0 12h-4M12 53h38M25 12c-3 4 3 5 0 9M35 11c-3 4 3 5 0 9" />
      </svg>
    </span>;
}
