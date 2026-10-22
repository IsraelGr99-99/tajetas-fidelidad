const benefits = [
  ["01", "Acumula", "Cada compra elegible suma una visita a tu tarjeta."],
  ["02", "Completa", "Llega a 9 visitas y desbloquea una bebida estándar."],
  ["03", "Disfruta", "Canjea tu recompensa en Café Nómada, sin letras pequeñas."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="#inicio" className="flex items-center gap-3 text-sm font-bold tracking-[.18em] text-[#3D2C24]" aria-label="Café Nómada, inicio">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#3D2C24] text-xl text-[#F5EBE6]" aria-hidden="true">✦</span>
          CAFÉ NÓMADA
        </a>
        <div className="hidden items-center gap-8 text-sm text-[#3D2C24]/75 sm:flex">
          <a href="#como-funciona" className="hover:text-[#A65D46]">Cómo funciona</a>
          <a href="https://iautomexa.com" className="rounded-full bg-[#3D2C24] px-5 py-3 text-[#F5EBE6] transition hover:bg-[#A65D46]">Conoce iautomexa</a>
        </div>
      </nav>

      <section id="inicio" className="grain relative mx-4 overflow-hidden rounded-[2rem] bg-[#3D2C24] px-6 py-16 text-[#F5EBE6] sm:mx-6 sm:px-12 lg:mx-10 lg:px-20 lg:py-24">
        <div className="relative z-10 max-w-3xl">
          <p className="mb-6 text-xs font-bold uppercase tracking-[.32em] text-[#D48C46]">San Pedro Cholula · Puebla</p>
          <h1 className="max-w-2xl text-5xl leading-[.98] sm:text-7xl">Historias que se cuentan taza a taza.</h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#F5EBE6]/75">Tu próxima historia empieza con un buen café. Guarda tus visitas, descubre tu progreso y vuelve por esa bebida que ya te ganaste.</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#registro" className="rounded-full bg-[#D48C46] px-7 py-4 text-center font-bold text-[#3D2C24] transition hover:bg-[#F5EBE6]">Crear mi tarjeta</a>
            <a href="#como-funciona" className="rounded-full border border-[#F5EBE6]/30 px-7 py-4 text-center font-bold transition hover:border-[#D48C46] hover:text-[#D48C46]">Ver cómo funciona</a>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-[#D48C46]/30 sm:h-96 sm:w-96" aria-hidden="true" />
        <div className="absolute bottom-8 right-8 hidden max-w-[210px] rotate-3 rounded-2xl bg-[#F5EBE6] p-5 text-[#3D2C24] shadow-2xl sm:block">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#A65D46]">Tu tarjeta</p>
          <div className="mt-5 grid grid-cols-5 gap-2">{Array.from({ length: 9 }, (_, i) => <span key={i} className="grid h-7 w-7 place-items-center rounded-full border border-[#D48C46] text-xs">{i < 4 ? "✦" : i + 1}</span>)}<span className="grid h-7 w-7 place-items-center rounded-full bg-[#D48C46] text-xs">★</span></div>
          <p className="mt-4 text-xs text-[#3D2C24]/60">4 de 9 visitas</p>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="max-w-xl"><p className="mb-4 text-xs font-bold uppercase tracking-[.25em] text-[#A65D46]">El ritual continúa</p><h2 className="text-4xl leading-tight text-[#3D2C24] sm:text-5xl">Una tarjeta para volver a lo que te hace bien.</h2></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">{benefits.map(([number, title, body]) => <article key={number} className="rounded-2xl border border-[#3D2C24]/10 bg-white/40 p-7"><span className="text-sm text-[#A65D46]">{number}</span><h3 className="mt-12 text-2xl text-[#3D2C24]">{title}</h3><p className="mt-3 leading-7 text-[#3D2C24]/65">{body}</p></article>)}</div>
      </section>

      <section id="registro" className="mx-6 mb-10 rounded-[2rem] bg-[#D48C46] px-6 py-14 text-center text-[#3D2C24] lg:mx-10 lg:px-10"><p className="stamp mx-auto inline-block rounded-full px-4 py-2 text-xs font-bold">PRÓXIMAMENTE EN LÍNEA</p><h2 className="mx-auto mt-6 max-w-2xl text-4xl leading-tight sm:text-5xl">Tu mesa de siempre, ahora también en tu bolsillo.</h2><p className="mx-auto mt-5 max-w-lg leading-7 text-[#3D2C24]/75">El registro digital estará disponible muy pronto. Mientras tanto, pasa a visitarnos y pregunta por tu tarjeta de Café Nómada.</p><a href="https://iautomexa.com" className="mt-8 inline-block rounded-full bg-[#3D2C24] px-7 py-4 font-bold text-[#F5EBE6] transition hover:bg-[#A65D46]">Conoce la tecnología detrás</a></section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 pb-8 text-xs text-[#3D2C24]/55 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>© 2026 Café Nómada</span><span>Una experiencia de <a className="underline" href="https://iautomexa.com">iautomexa</a></span></footer>
    </main>
  );
}
