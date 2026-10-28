"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Progressive enhancement: the server-rendered content is always visible without JS. */
export function MarketingMotion({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const container = root.current;
    if (!container) return;

    const mobileMenu = container.querySelector<HTMLDetailsElement>("[data-mobile-menu]");
    const closeMenu = () => { if (mobileMenu) mobileMenu.open = false; };
    const onMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !mobileMenu?.open) return;
      closeMenu();
      mobileMenu.querySelector("summary")?.focus();
    };
    const onOutsideClick = (event: PointerEvent) => {
      if (mobileMenu?.open && event.target instanceof Node && !mobileMenu.contains(event.target)) closeMenu();
    };
    mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    mobileMenu?.addEventListener("keydown", onMenuKeyDown);
    document.addEventListener("pointerdown", onOutsideClick);

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const hero = container.querySelector<HTMLElement>("[data-motion-hero]");
      if (hero) {
        gsap.timeline({ defaults: { ease: "power3.out" } })
          .from(hero.querySelector("[data-motion-brand]"), { y: 12, opacity: 0.7, duration: 0.45 })
          .from(hero.querySelector("h1"), { y: 18, duration: 0.65 }, "-=0.26")
          .from(hero.querySelector("[data-motion-lead]"), { y: 15, opacity: 0.78, duration: 0.55 }, "-=0.43")
          .from(hero.querySelector("[data-motion-actions]"), { y: 12, opacity: 0.78, duration: 0.48 }, "-=0.36")
          .from(hero.querySelector("[data-motion-visual]"), { y: 30, scale: 0.985, opacity: 0.8, duration: 0.78 }, "-=0.6");
      }

      container.querySelectorAll<HTMLElement>("[data-motion-section]").forEach((section) => {
        const target = section.querySelector<HTMLElement>("h2");
        if (!target) return;
        ScrollTrigger.create({
          trigger: section,
          start: "top 84%",
          once: true,
          onEnter: () => gsap.fromTo(target, { y: 22, opacity: 0.8 }, { y: 0, opacity: 1, duration: 0.72, ease: "power3.out" }),
        });
      });
    });

    const navLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>("[data-section-link]"));
    navLinks.forEach((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      ScrollTrigger.create({
        trigger: target,
        start: "top 38%",
        end: "bottom 38%",
        onToggle: (self) => {
          if (self.isActive) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        },
      });
    });

    return () => {
      mm.revert();
      mobileMenu?.querySelectorAll("a").forEach((link) => link.removeEventListener("click", closeMenu));
      mobileMenu?.removeEventListener("keydown", onMenuKeyDown);
      document.removeEventListener("pointerdown", onOutsideClick);
    };
  }, { scope: root });

  return <div ref={root} className={className}>{children}</div>;
}
