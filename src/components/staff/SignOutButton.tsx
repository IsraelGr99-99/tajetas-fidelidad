import { signOutAction } from "@/app/personal/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? "btn btn-contorno min-h-11 px-4 text-sm"}>
        Cerrar sesión
      </button>
    </form>
  );
}
