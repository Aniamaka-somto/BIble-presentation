import { Fragment, useLayoutEffect, useRef } from "react";
import type { Slide } from "../../shared/types";

// ---------------------------------------------------------------------------
// The display engine. Every slide is laid out ONCE on a fixed 1920x1080
// canvas: font-size is auto-fitted against the safe area, then the whole
// canvas is scaled down to whatever box shows it (operator preview, operator
// live monitor, projector window). Because layout never happens at the small
// size, all displays look pixel-identical.
// ---------------------------------------------------------------------------

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;
export const FS_MIN = 30; // font-size range, in canvas px
export const FS_MAX = 96;

export interface SlideFit {
  size: number;
  overflow: boolean;
}

interface SlideFitCache {
  _fit?: SlideFit;
}

// Binary-search the biggest font size whose text still fits inside the safe area.
export function fitSlideElement(el: HTMLElement): SlideFit {
  const safe = el.querySelector<HTMLElement>(".slide-safe");
  const flow = el.querySelector<HTMLElement>(".slide-flow");
  if (!safe || !flow) return { size: FS_MIN, overflow: false };
  let lo = FS_MIN;
  let hi = FS_MAX;
  let best = FS_MIN;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    el.style.setProperty("--fs", mid + "px");
    if (flow.offsetHeight <= safe.clientHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  el.style.setProperty("--fs", best + "px");
  return { size: best, overflow: flow.offsetHeight > safe.clientHeight };
}

export function SlideView({ slide }: { slide: Slide }) {
  return (
    <div className="slide">
      <div className="slide-safe">
        <div className="slide-flow">
          {slide.blocks.map((b, bi) => (
            <div className="s-block" key={bi}>
              <div className="s-text">
                {b.parts.map((p, pi) => (
                  <Fragment key={pi}>
                    {p.num !== undefined ? <sup className="s-num">{p.num}</sup> : null}
                    {p.text}
                    {pi < b.parts.length - 1 ? " " : ""}
                  </Fragment>
                ))}
              </div>
              <div className="s-ref">{b.ref.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// A 16:9 box that renders a slide: scale the canvas to the box, auto-fit once
// (unless an authoritative fontSize is supplied by the operator), re-scale on
// resize, and re-fit after web fonts are ready.
export function SlideMonitor({
  slide,
  className = "",
  emptyText = "",
  emptyClass = "monitor-empty",
  fontSize,
  onFit,
}: {
  slide: Slide | null;
  className?: string;
  emptyText?: string;
  emptyClass?: string;
  fontSize?: number | null;
  onFit?: (fit: SlideFit) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const found = host.querySelector<HTMLElement>(".slide");
    if (!found) return;
    const el: HTMLElement = found;

    delete (el as SlideFitCache)._fit;

    function applyScale() {
      if (host && host.clientWidth) {
        el.style.transform = `scale(${host.clientWidth / SLIDE_W})`;
      }
    }
    function defaultFit() {
      const fit = fitSlideElement(el);
      (el as SlideFitCache)._fit = fit;
      onFitRef.current?.(fit);
    }
    function fitOnce() {
      if (fontSize != null && fontSize > 0) {
        el.style.setProperty("--fs", fontSize + "px");
        return;
      }
      if ((el as SlideFitCache)._fit) return;
      defaultFit();
    }

    applyScale();
    fitOnce();

    const ro = new ResizeObserver(() => applyScale());
    ro.observe(host);

    let cancelled = false;
    const fontsReady = (
      document as unknown as { fonts?: { ready?: Promise<unknown> } }
    ).fonts?.ready;
    fontsReady?.then(() => {
      if (cancelled) return;
      delete (el as SlideFitCache)._fit;
      if (fontSize != null && fontSize > 0) {
        el.style.setProperty("--fs", fontSize + "px");
      } else {
        defaultFit();
      }
    });

    return () => {
      ro.disconnect();
      cancelled = true;
    };
  }, [slide, fontSize]);

  return (
    <div ref={hostRef} className={className}>
      {slide ? (
        <SlideView slide={slide} />
      ) : (
        <span className={emptyClass}>{emptyText}</span>
      )}
    </div>
  );
}