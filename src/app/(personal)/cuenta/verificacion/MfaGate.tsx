"use client";

import { useRouter } from "next/navigation";
import { MfaChallenge } from "@/components/staff/Mfa";

export function MfaGate() {
  const router = useRouter();
  return (
    <MfaChallenge
      onDone={() => {
        router.replace("/negocio");
        router.refresh();
      }}
    />
  );
}
