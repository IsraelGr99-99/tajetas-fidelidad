"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

/** API nativa (Chrome/Android, Edge). No está en los tipos de TypeScript. */
type NativeBarcodeDetector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

type CameraState = "off" | "starting" | "scanning" | "denied" | "unavailable" | "error";

const SCAN_INTERVAL_MS = 200;

/**
 * Lector de QR para la barra:
 *  1. Cámara con lectura nativa (`BarcodeDetector`) si el navegador la tiene.
 *  2. Si no (Safari/iOS), cámara + `jsqr`, cargado solo en ese caso.
 *  3. Campo de texto para lectores USB (escriben como teclado) o pegar el código.
 * Lo leído es entrada no confiable: quien lo valida es el servidor.
 */
export function QrScanner({ onScan, label = "Escanea el código QR del cliente" }: { onScan: (text: string) => void; label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onScanRef = useRef(onScan);
  const [camera, setCamera] = useState<CameraState>("off");
  const [enabled, setEnabled] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const manualId = useId();

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "unavailable" : "error");
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCamera("scanning");

      const decode = await createDecoder(canvasRef.current).catch(() => null);
      if (!decode) {
        stream?.getTracks().forEach((track) => track.stop());
        setCamera("error");
        return;
      }
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          const text = await decode(video).catch(() => null);
          if (text && !stopped) {
            stopped = true;
            stream?.getTracks().forEach((t) => t.stop());
            setEnabled(false);
            setCamera("off");
            onScanRef.current(text);
            return;
          }
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, requestKey]);

  function toggleCamera() {
    if (enabled && camera !== "starting" && camera !== "scanning") {
      setCamera("starting");
      setRequestKey((key) => key + 1);
      return;
    }
    setEnabled((current) => {
      setCamera(current ? "off" : "starting");
      return !current;
    });
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("manual") as HTMLInputElement;
    const value = input.value.trim();
    if (value) onScan(value);
    input.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-tabaco">Lector de cámara</p>
        <button type="button" onClick={toggleCamera} aria-pressed={enabled && (camera === "starting" || camera === "scanning")} className="min-h-11 cursor-pointer rounded-xl border border-tabaco/20 bg-papel px-4 text-sm font-semibold text-tabaco transition hover:border-tabaco hover:bg-crema focus-visible:outline-3 focus-visible:outline-mostaza">
          {enabled && (camera === "starting" || camera === "scanning") ? "Apagar cámara" : enabled ? "Reintentar cámara" : "Encender cámara"}
        </button>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-tinta">
        <video ref={videoRef} muted playsInline aria-hidden="true" className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        {camera === "scanning" ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-mostaza/80 shadow-[0_0_0_999px_rgb(36_25_20/0.35)]" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm leading-6 text-crema">
            {camera === "off" ? "Cámara apagada. Enciéndela para escanear o escribe el código abajo." : null}
            {camera === "starting" ? "Abriendo la cámara…" : null}
            {camera === "denied" ? "El navegador bloqueó la cámara. Puedes volver a intentar aquí; si negaste el permiso permanentemente, cámbialo en el navegador o usa el campo de abajo." : null}
            {camera === "unavailable" ? "Este dispositivo no tiene cámara disponible (o la página no es segura). Usa un lector USB o el campo de abajo." : null}
            {camera === "error" ? "No se pudo abrir la cámara. Cierra otras apps que la usen y vuelve a intentar." : null}
          </div>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-center text-sm text-tabaco/80">
        {camera === "scanning" ? label : null}
      </p>

      <form onSubmit={onManualSubmit} className="flex gap-2">
        <label htmlFor={manualId} className="sr-only">
          Código leído con lector USB o pegado
        </label>
        <input
          id={manualId}
          name="manual"
          autoComplete="off"
          spellCheck={false}
          placeholder="Lector USB o pegar código"
          className="min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta outline-none placeholder:text-tabaco/45 focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza"
        />
        <button type="submit" className="btn btn-oscuro shrink-0 px-5">
          Usar
        </button>
      </form>
    </div>
  );
}

async function createDecoder(canvas: HTMLCanvasElement | null): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  const Native = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Native) {
    const formats = (await Native.getSupportedFormats?.().catch(() => [])) ?? [];
    if (formats.includes("qr_code")) {
      const detector = new Native({ formats: ["qr_code"] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
    }
  }

  const { default: jsQR } = await import("jsqr");
  const ctx = canvas?.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!canvas || !ctx || !video.videoWidth) return null;
    // Reducir la imagen acelera la lectura sin perder un QR a distancia de mostrador.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
