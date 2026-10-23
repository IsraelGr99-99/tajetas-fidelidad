import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { Topography } from "@/components/brand/Topography";
import { PassportCard } from "@/components/loyalty/PassportCard";
import { PILOT_CAMPAIGN } from "@/domain/loyalty/campaign";

const BUSINESS_URL = "https://iautomexa.com";

// Es una secuencia real (registro → visita → recompensa): los números de parada tienen sentido.
const route = [
  { title: "Regístrate con un solo dato", body: "Tu correo o tu teléfono, el que prefieras. Te mandamos un código y listo: sin contraseñas ni apps." },
  { title: "Muestra tu código al pagar", body: "El barista lo escanea, confirma tu compra y tu bitácora recibe un sello nuevo al instante." },
  {
    title: `Al sello ${PILOT_CAMPAIGN.stampsRequired}, la siguiente va por la casa`,
    body: "Tu bebida queda guardada hasta que tú decidas canjearla desde tu teléfono.",
  },
];

const fairPlay = [
  "Un sello por cada compra elegible completada.",
  "Las compras anuladas, devueltas y las cortesías no suman.",
  "Tu bebida de regalo vale hasta lo que costó la bebida elegible más económica del ticket que completó tu tarjeta.",
  "Cada sello y cada canje quedan en tu historial.",
];

export default function Home() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 text-crema sm:px-8">
          <Link href="/" aria-label="Café Nómada, inicio" className="rounded-full">
            <Wordmark />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-2 text-sm font-semibold sm:gap-6">
            <a href="#ruta" className="hidden underline-offset-4 hover:underline sm:inline">
              Cómo funciona
            </a>
            <Link href="/tarjeta" className="whitespace-nowrap rounded-full px-3 py-2 underline-offset-4 hover:underline">
              Mi tarjeta
            </Link>
            <a href={BUSINESS_URL} className="btn btn-contorno hidden min-h-10 px-4 text-sm sm:inline-flex">
              Conoce iautomexa
            </a>
          </nav>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="outline-none">
        {/* Portada: la bitácora como protagonista sobre un mapa */}
        <section className="relative overflow-hidden bg-tabaco text-crema">
          <Topography className="pointer-events-none absolute inset-0 h-full w-full text-crema/[0.07]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-28 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-28 lg:pt-36">
            <div className="[animation:aparece_700ms_ease-out_both]">
              <p className="text-sm font-semibold text-mostaza">San Pedro Cholula, Puebla</p>
              <h1
                className="mt-4 text-[2.9rem] leading-[0.98] sm:text-7xl lg:text-[5.4rem]"
                style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144' }}
              >
                Historias que se cuentan taza a taza.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-8 text-crema/80">
                Cada visita estampa una parada en tu bitácora. Junta {PILOT_CAMPAIGN.stampsRequired} y la siguiente bebida corre por nuestra
                cuenta.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/tarjeta/acceso" className="btn btn-primario min-h-14 px-7 text-lg">
                  Quiero mi tarjeta
                </Link>
                <a href="#ruta" className="btn btn-contorno min-h-14 px-7">
                  Ver cómo funciona
                </a>
              </div>
              <p className="mt-6 text-sm text-crema/70">Gratis, sin descargar nada. Funciona en el navegador de tu teléfono.</p>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-mostaza/20 blur-3xl" aria-hidden="true" />
              <PassportCard
                sample
                intro
                stampsBalance={5}
                stampsRequired={PILOT_CAMPAIGN.stampsRequired}
                rewardsAvailable={0}
                rewardDescription={PILOT_CAMPAIGN.rewardDescription}
                className="relative rotate-[-2deg]"
              />
            </div>
          </div>
          {/* Borde inferior tipo boleto perforado */}
          <div className="relative h-4 bg-[radial-gradient(circle_at_10px_100%,var(--color-crema)_8px,transparent_8.5px)] bg-[length:20px_16px]" aria-hidden="true" />
        </section>

        {/* La ruta: tres paradas */}
        <section id="ruta" aria-labelledby="ruta-titulo" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8 sm:py-24">
          <h2 id="ruta-titulo" className="max-w-xl text-4xl leading-tight text-tabaco sm:text-5xl">
            Tu ruta hacia la próxima taza
          </h2>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <span aria-hidden="true" className="absolute left-6 top-6 hidden h-px w-[calc(100%-3rem)] border-t-2 border-dashed border-tabaco/25 md:block" />
            {route.map((s, i) => (
              <li key={s.title} className="relative flex gap-5 md:block">
                <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-arcilla-texto bg-crema font-display text-xl text-arcilla-texto">
                  {i + 1}
                </span>
                <div className="md:mt-6">
                  <h3 className="text-2xl leading-snug text-tabaco">{s.title}</h3>
                  <p className="mt-2 max-w-sm leading-7 text-tabaco/80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Reglas y privacidad */}
        <section aria-labelledby="reglas-titulo" className="bg-papel">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <h2 id="reglas-titulo" className="text-3xl leading-tight text-tabaco sm:text-4xl">
                Reglas claras, sin letra pequeña
              </h2>
              <ul className="mt-8 space-y-5">
                {fairPlay.map((rule) => (
                  <li key={rule} className="flex gap-4 leading-7 text-tabaco/85">
                    <svg viewBox="0 0 24 24" className="mt-1 h-5 w-5 shrink-0 text-arcilla-texto" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
            <aside aria-labelledby="datos-titulo" className="relative rotate-1 rounded-3xl bg-crema p-8 shadow-[0_20px_40px_-25px_rgb(36_25_20/0.5)]">
              <span aria-hidden="true" className="absolute -top-3 left-10 h-6 w-20 -rotate-3 rounded-sm bg-mostaza/50" />
              <h2 id="datos-titulo" className="font-display text-2xl text-tabaco">
                Pedimos lo mínimo
              </h2>
              <p className="mt-4 leading-7 text-tabaco/85">
                Solo un medio de contacto verificado: correo <em>o</em> teléfono. Tu código cambia cada dos minutos y no lleva tu nombre, tu contacto
                ni tus sellos. En la barra solo ven lo necesario para atenderte.
              </p>
              <Link href="/privacidad" className="mt-5 inline-block font-semibold text-arcilla-texto underline underline-offset-4">
                Leer el aviso de privacidad
              </Link>
            </aside>
          </div>
        </section>

        {/* Llamado final */}
        <section aria-labelledby="registro-titulo" className="relative overflow-hidden bg-mostaza text-tabaco">
          <Topography className="pointer-events-none absolute inset-0 h-full w-full text-tabaco/[0.08]" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <LogoMark className="h-16 w-16 shrink-0" />
              <h2 id="registro-titulo" className="max-w-xl text-4xl leading-tight sm:text-5xl">
                El hogar lejos de casa, ahora en tu bolsillo.
              </h2>
            </div>
            <Link href="/tarjeta/acceso" className="btn btn-oscuro min-h-14 shrink-0 px-8 text-lg">
              Crear mi tarjeta
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-tabaco text-crema/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Café Nómada. Café de origen, alma de viajero.</span>
          <span className="flex gap-5">
            <Link href="/entrar" className="underline-offset-4 hover:underline">
              Acceso del personal
            </Link>
            <a href={BUSINESS_URL} className="font-semibold underline underline-offset-4">
              Hecho con iautomexa
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
