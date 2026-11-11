import { useEffect, useRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { finishVisit } from "../lib/visit";
import type { View } from "../types";

type Props = {
  name: string;
  ready: boolean;
  onView: (view: View) => void;
};

const WAIT = 2500;

function go(show: (view: View) => void, view: View, move: () => void) {
  show(view);
  move();
}

function steps(show: (view: View) => void): DriveStep[] {
  return [
    {
      element: "[data-tour='recherche']",
      popover: {
        title: "Cherchez un produit",
        description: "Tapez lait, pain ou poulet. Comparo ouvre le catalogue.",
        side: "bottom",
        align: "start",
        onNextClick: (_element, _step, opts) => go(show, "catalogue", () => opts.driver.moveNext()),
      },
    },
    {
      element: "[data-tour='prix']",
      waitForElement: WAIT,
      popover: {
        title: "Le vert est le moins cher",
        description: "Chaque carte montre le Maxi de Laflèche et l’IGA de la rue de Bretagne. Le cadre vert est le prix à prendre.",
        side: "bottom",
        align: "start",
        onPrevClick: (_element, _step, opts) => opts.driver.movePrevious(),
        onNextClick: (_element, _step, opts) => go(show, "liste", () => opts.driver.moveNext()),
      },
    },
    {
      element: "[data-tour='liste']",
      waitForElement: WAIT,
      popover: {
        title: "Deux arrêts, une économie",
        description: "La liste compare un arrêt au Maxi, un arrêt à l’IGA, et le parcours qui prend chaque article au moins cher.",
        side: "bottom",
        align: "start",
        onPrevClick: (_element, _step, opts) => go(show, "catalogue", () => opts.driver.movePrevious()),
        onNextClick: (_element, _step, opts) => go(show, "repas", () => opts.driver.moveNext()),
      },
    },
    {
      element: "[data-tour='repas']",
      waitForElement: WAIT,
      popover: {
        title: "Une semaine prépare les courses",
        description: "Répondez une fois. Comparo propose sept soupers, puis peut ajouter les ingrédients à la liste.",
        side: "bottom",
        align: "start",
        onPrevClick: (_element, _step, opts) => go(show, "liste", () => opts.driver.movePrevious()),
        onNextClick: (_element, _step, opts) => go(show, "essence", () => opts.driver.moveNext()),
      },
    },
    {
      element: "[data-tour='essence']",
      waitForElement: WAIT,
      popover: {
        title: "Le plein le moins cher",
        description: "Sur la carte, le vert est la station la moins chère à Baie-Comeau. Touchez une station pour la centrer.",
        side: "top",
        align: "start",
        onPrevClick: (_element, _step, opts) => go(show, "repas", () => opts.driver.movePrevious()),
        onDoneClick: (_element, _step, opts) => opts.driver.destroy(),
      },
    },
  ];
}

export function Visit({ name, ready, onView }: Props) {
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    if (!ready) return;
    let tour: Driver | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      tour = driver({
        animate: !motion,
        smoothScroll: !motion,
        allowClose: true,
        allowScroll: true,
        allowKeyboardControl: true,
        overlayClickBehavior: "none",
        overlayOpacity: 0.55,
        stagePadding: 8,
        stageRadius: 18,
        disableActiveInteraction: true,
        popoverClass: "comparo-visite",
        showButtons: ["next", "previous", "close"],
        showProgress: true,
        progressText: "{{current}} sur {{total}}",
        nextBtnText: "Suivant",
        prevBtnText: "Retour",
        doneBtnText: "Terminer",
        closeBtnLabel: "Fermer la visite",
        steps: steps((view) => onViewRef.current(view)),
        onDestroyed: (_element, _step, opts) => {
          if (opts.reason === "api") return;
          finishVisit(name);
          onViewRef.current("accueil");
        },
      });
      tour.drive();
    }, 350);

    return () => {
      window.clearTimeout(timer);
      tour?.destroy();
    };
  }, [ready, name]);

  return null;
}
