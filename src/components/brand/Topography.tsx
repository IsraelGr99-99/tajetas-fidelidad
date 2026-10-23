/** Curvas de nivel como de mapa de viaje. Decorativo; color heredado (`currentColor`). */
export function Topography({ className }: { className?: string }) {
  const rings = [
    { cx: 78, cy: 30, r: [6, 11, 16, 22, 29, 37, 46] },
    { cx: 18, cy: 82, r: [5, 10, 16, 23, 31] },
  ];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" fill="none" stroke="currentColor">
      {rings.map((g, gi) =>
        g.r.map((r, i) => (
          <path
            key={`${gi}-${i}`}
            vectorEffect="non-scaling-stroke"
            strokeWidth="1"
            // Contornos irregulares: elipses deformadas con curvas cúbicas.
            d={`M ${g.cx - r} ${g.cy}
                C ${g.cx - r} ${g.cy - r * 0.8}, ${g.cx - r * 0.2} ${g.cy - r * 1.05}, ${g.cx + r * 0.35} ${g.cy - r * 0.9}
                S ${g.cx + r * 1.1} ${g.cy - r * 0.15}, ${g.cx + r * 0.9} ${g.cy + r * 0.45}
                S ${g.cx + r * 0.1} ${g.cy + r * 1.05}, ${g.cx - r * 0.45} ${g.cy + r * 0.8}
                S ${g.cx - r} ${g.cy + r * 0.35}, ${g.cx - r} ${g.cy} Z`}
          />
        )),
      )}
    </svg>
  );
}
