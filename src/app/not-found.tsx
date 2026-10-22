import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center text-tabaco">
      <LogoMark className="h-16 w-16" />
      <p className="bitacora mt-8 text-arcilla-texto">Error 404 · Ruta desconocida</p>
      <h1 className="mt-3 text-4xl">Esta página se perdió en el camino.</h1>
      <p className="mt-4 leading-7 text-tabaco/75">Revisa la dirección o vuelve al inicio para seguir tu bitácora.</p>
      <Link href="/" className="btn btn-oscuro mt-8">
        Volver al inicio
      </Link>
    </main>
  );
}
