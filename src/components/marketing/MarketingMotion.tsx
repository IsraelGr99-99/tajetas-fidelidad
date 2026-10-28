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
    const q = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = container) => Array.from(scope.querySelectorAll<T>(selector) as NodeListOf<T>);

    // Mobile menu: close on link, Escape or outside click.
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

    // Header gets a compact, solid style once the page scrolls.
    const header = container.querySelector<HTMLElement>("[data-header]");
    if (header) ScrollTrigger.create({ start: 12, end: "max", onToggle: (self) => header.setAttribute("data-scrolled", String(self.isActive)) });

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Hero: words rise, then copy, then the product stage.
      const hero = container.querySelector<HTMLElement>("[data-motion-hero]");
      if (hero) {
        const stage = hero.querySelector("[data-hero-stage]");
        gsap.timeline({ defaults: { ease: "expo.out" } })
          .from(q("[data-word]", hero), { yPercent: 105, duration: 1.1, stagger: 0.06 })
          .from(q("[data-hero-fade]", hero), { y: 18, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.15)
          .from(stage, { y: 80, rotateX: 14, autoAlpha: 0, duration: 1.4, transformPerspective: 1600 }, 0.45)
          .from(q("[data-chip]", hero), { scale: 0.6, autoAlpha: 0, duration: 0.7, stagger: 0.14, ease: "back.out(2)" }, 1.1);

        q("[data-chip]", hero).forEach((chip, i) => {
          gsap.to(chip, { y: i % 2 ? 10 : -10, duration: 2.6 + i * 0.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.8 });
        });

        // On scroll the laptop settles flat and the phone drifts up.
        gsap.fromTo(hero.querySelector("[data-hero-device]"), { rotateX: 10 }, {
          rotateX: 0, ease: "none", transformPerspective: 1600,
          scrollTrigger: { trigger: stage, start: "top 90%", end: "center 40%", scrub: true },
        });
        gsap.to(hero.querySelector("[data-hero-phone]"), {
          yPercent: -14, ease: "none",
          scrollTrigger: { trigger: stage, start: "top 70%", end: "bottom top", scrub: true },
        });
      }

      // Slow drifting aurora blobs.
      q("[data-aurora]").forEach((blob, i) => {
        gsap.to(blob, { xPercent: i % 2 ? -18 : 16, yPercent: i % 2 ? 12 : -10, scale: 1.12, duration: 9 + i * 2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });

      // Infinite modules marquee (the list is duplicated in the markup).
      const marquee = container.querySelector<HTMLElement>("[data-marquee]");
      if (marquee) gsap.to(marquee, { xPercent: -50, duration: 38, repeat: -1, ease: "none" });

      // Generic reveal for headings and cards.
      gsap.set(q("[data-reveal]"), { y: 40, autoAlpha: 0 });
      ScrollTrigger.batch(q("[data-reveal]"), {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.09, ease: "expo.out", overwrite: true }),
      });

      // Bars and meters grow when visible.
      q("[data-grow]").forEach((bar, i) => gsap.from(bar, { scaleY: 0, duration: 1.1, delay: (i % 10) * 0.05, ease: "expo.out", scrollTrigger: { trigger: bar.parentElement, start: "top 85%", once: true } }));
      q("[data-grow-x]").forEach((bar) => gsap.from(bar, { scaleX: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: bar.parentElement, start: "top 90%", once: true } }));
      q("[data-stamp]").forEach((stamp) => gsap.from(stamp, { scale: 0.4, autoAlpha: 0, duration: 0.6, ease: "back.out(2.4)", scrollTrigger: { trigger: stamp, start: "top 92%", once: true } }));

      // Connected flow: the line draws itself and each step lights up.
      const flow = container.querySelector<HTMLElement>("[data-flow]");
      const path = flow?.querySelector<SVGPathElement>("[data-flow-path]");
      if (flow && path) {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        const nodes = q("[data-flow-node]", flow);
        const timeline = gsap.timeline({ scrollTrigger: { trigger: flow.querySelector("ol"), start: "top 75%", end: "bottom 55%", scrub: 0.6 } });
        timeline.to(path, { strokeDashoffset: 0, ease: "none", duration: nodes.length });
        nodes.forEach((node, i) => timeline.from(node, { y: 30, autoAlpha: 0.15, duration: 0.6 }, i * 0.9));
      }

      // Wallet: the pass slides into the phone.
      const pass = container.querySelector("[data-wallet-pass]");
      if (pass) gsap.from(pass, { yPercent: 70, rotate: -6, autoAlpha: 0, ease: "power3.out", scrollTrigger: { trigger: pass, start: "top 98%", end: "top 55%", scrub: 0.8 } });
    });

    // Desktop tour: pin the stage while screens change, Apple-style.
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const stage = container.querySelector<HTMLElement>("[data-tour-stage]");
      if (!stage) return;
      const steps = q("[data-tour-step]", stage);
      const screens = q("[data-tour-screen]", stage);
      const bar = stage.querySelector("[data-tour-bar]");
      if (steps.length < 2 || steps.length !== screens.length) return;

      stage.setAttribute("data-enhanced", "true");
      const setActive = (index: number) => steps.forEach((step, i) => {
        if (i === index) step.setAttribute("data-active", "true");
        else step.removeAttribute("data-active");
      });
      setActive(0);
      gsap.set(screens.slice(1), { autoAlpha: 0, yPercent: 8, scale: 0.94 });

      const timeline = gsap.timeline({
        defaults: { ease: "power2.inOut", duration: 1 },
        scrollTrigger: {
          trigger: stage,
          start: "top 64px",
          end: () => `+=${Math.round(window.innerHeight * 0.75 * (steps.length - 1))}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setActive(Math.min(steps.length - 1, Math.round(self.progress * (steps.length - 1)))),
        },
      });
      if (bar) timeline.fromTo(bar, { scaleX: 1 / steps.length }, { scaleX: 1, ease: "none", duration: steps.length - 1 }, 0);
      // Each screen holds still for most of its segment; the swap happens mid-way.
      screens.slice(0, -1).forEach((screen, i) => {
        timeline.to(screen, { autoAlpha: 0, yPercent: -8, scale: 0.94, duration: 0.45 }, i + 0.3);
        timeline.to(screens[i + 1], { autoAlpha: 1, yPercent: 0, scale: 1, duration: 0.45 }, i + 0.45);
      });

      return () => {
        stage.removeAttribute("data-enhanced");
        steps.forEach((step, i) => i === 0 ? step.setAttribute("data-active", "true") : step.removeAttribute("data-active"));
      };
    });

    // Current section in the navigation. Created after the pins so positions include their spacing.
    q<HTMLAnchorElement>("[data-section-link]").forEach((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      ScrollTrigger.create({
        trigger: target,
        start: "top 40%",
        end: "bottom 40%",
        refreshPriority: -1,
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
