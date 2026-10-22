import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { StampCard } from "@/components/loyalty/StampCard";
import { PILOT_CAMPAIGN } from "@/domain/loyalty/campaign";

const BUSINESS_URL = "https://iautomexa.com";

const steps = [
  {
    n: "01",
    title: "Regístrate con un solo dato",
    body: "Elige tu correo o tu teléfono, el que prefieras. Lo verificamos con un código y no te pedimos nada más.",
  },
  {
    n: "02",
    title: "Muestra tu tarjeta al pagar",
    body: "El barista escanea tu código y confirma la compra. Cada compra elegible suma un sello a tu bitácora.",
  },
  {
    n: "03",
    title: `Al sello ${PILOT_CAMPAIGN.stampsRequired}, la siguiente va por la casa`,
    body: "Tu recompensa queda guardada hasta que decidas canjearla. Tú confirmas el canje desde tu teléfono.",
  },
];

const fairPlay = [
  "Un sello por compra elegible completada.",
  "No suman las compras anuladas, devueltas, cortesías ni bebidas gratuitas.",
  "La bebida de recompensa vale hasta lo que costó la bebida elegible más económica del ticket que completó tu tarjeta.",
  "Cada movimiento queda registrado y puedes consultarlo en tu historial.",
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 text-tabaco sm:px-8">
        <a href="#contenido" aria-label="Café Nómada, ir al inicio" className="rounded-full">
          <Wordmark />
        </a>
        <nav aria-label="Principal" className="flex items-center gap-6 text-sm font-medium">
          <a href="#como-funciona" className="hidden underline-offset-4 hover:underline sm:inline">
            Cómo funciona
          </a>
          <a href="#reglas" className="hidden underline-offset-4 hover:underline sm:inline">
            Reglas claras
          </a>
          <a href={BUSINESS_URL} className="btn btn-oscuro min-h-11 whitespace-nowrap px-4 text-sm sm:px-5">
            Conoce iautomexa
          </a>
        </nav>
      </header>

      <main id="contenido" tabIndex={-1} className="outline-none">
        {/* Portada */}
        <section className="grain relative mx-3 overflow-hidden rounded-[2rem] bg-tabaco text-crema sm:mx-6 lg:mx-8">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-14 sm:px-10 lg:grid-cols-[1.15fr_.85fr] lg:py-24">
            <div>
              <p className="bitacora text-mostaza">San Pedro Cholula · Puebla</p>
              <h1 className="mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl">
                Historias que se cuentan <em className="text-mostaza not-italic">taza a taza.</em>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-crema/80">
                El hogar lejos de casa ahora también vive en tu teléfono. Junta sellos con cada visita, sigue tu progreso y vuelve por esa
                bebida que ya te ganaste.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/tarjeta/acceso" className="btn btn-primario">
                  Quiero mi tarjeta
                </Link>
                <a href="#como-funciona" className="btn btn-contorno">
                  Ver cómo funciona
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm lg:rotate-2">
              <StampCard
                sample
                stampsBalance={4}
                stampsRequired={PILOT_CAMPAIGN.stampsRequired}
                rewardsAvailable={0}
                rewardDescription={PILOT_CAMPAIGN.rewardDescription}
              />
            </div>
          </div>
          <svg className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 text-mostaza/25" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeDasharray="2 6" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" />
          </svg>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8">
          <p className="bitacora text-arcilla-texto">Cómo funciona</p>
          <h2 id="como-funciona-titulo" className="mt-3 max-w-2xl text-4xl leading-tight text-tabaco sm:text-5xl">
            Una tarjeta para volver a lo que te hace bien.
          </h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="rounded-3xl border border-tabaco/10 bg-papel p-7">
                <span className="bitacora text-arcilla-texto">Parada {s.n}</span>
                <h3 className="mt-8 text-2xl leading-snug text-tabaco">{s.title}</h3>
                <p className="mt-3 leading-7 text-tabaco/75">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Reglas y privacidad */}
        <section id="reglas" aria-labelledby="reglas-titulo" className="mx-auto grid max-w-6xl scroll-mt-6 gap-6 px-5 pb-20 sm:px-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-arcilla-texto p-8 text-crema sm:p-10">
            <p className="bitacora text-mostaza-200">Reglas claras</p>
            <h2 id="reglas-titulo" className="mt-3 text-3xl leading-tight sm:text-4xl">
              Sin letras pequeñas.
            </h2>
            <ul className="mt-6 space-y-4">
              {fairPlay.map((rule) => (
                <li key={rule} className="flex gap-3 leading-7">
                  <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rotate-45 bg-mostaza" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-tabaco/10 bg-papel p-8 sm:p-10">
            <p className="bitacora text-arcilla-texto">Tus datos</p>
            <h2 className="mt-3 text-3xl leading-tight text-tabaco sm:text-4xl">Pedimos lo mínimo, y lo cuidamos.</h2>
            <p className="mt-6 leading-7 text-tabaco/80">
              Solo necesitamos un medio de contacto verificado: correo <strong>o</strong> teléfono. Tu código QR no contiene tu nombre,
              teléfono, correo ni tus sellos, y caduca a los pocos minutos. El personal solo ve lo necesario para atenderte.
            </p>
            <p className="mt-4 leading-7 text-tabaco/80">
              Podrás guardar tu tarjeta en Apple Wallet o Google Wallet cuando esa opción esté habilitada para el piloto. Consulta el{" "}
              <Link href="/privacidad" className="font-semibold underline underline-offset-4">
                aviso de privacidad
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Registro */}
        <section id="registro" aria-labelledby="registro-titulo" className="mx-3 mb-10 scroll-mt-6 rounded-[2rem] bg-mostaza px-6 py-16 text-center text-tabaco sm:mx-6 lg:mx-8">
          <LogoMark className="mx-auto h-14 w-14" />
          <p className="bitacora mx-auto mt-6 inline-block rounded-full border border-tabaco/40 px-4 py-2 font-bold">Piloto en San Pedro Cholula</p>
          <h2 id="registro-titulo" className="mx-auto mt-6 max-w-2xl text-4xl leading-tight sm:text-5xl">
            Tu mesa de siempre, ahora también en tu bolsillo.
          </h2>
          <p className="mx-auto mt-5 max-w-lg leading-7 text-tabaco">
            Crea tu tarjeta en un minuto con tu correo. Sin contraseñas y sin descargar nada.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/tarjeta/acceso" className="btn btn-oscuro">
              Crear mi tarjeta
            </Link>
            <a href={BUSINESS_URL} className="btn min-h-12 border border-tabaco/40 px-6 text-tabaco hover:border-tabaco">
              Conoce la tecnología detrás
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 pb-10 text-sm text-tabaco/75 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>© {new Date().getFullYear()} Café Nómada · Café de origen, alma de viajero</span>
        <span>
          Tecnología de{" "}
          <a className="font-semibold underline underline-offset-4" href={BUSINESS_URL}>
            iautomexa
          </a>
        </span>
      </footer>
    </>
  );
}
