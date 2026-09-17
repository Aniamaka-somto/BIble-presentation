import { useLayoutEffect, useRef } from 'react'

// Imperative text-fitting ported from the vanilla console. Each verse panel
// shrinks its font until the text fits (92% of container height), starting
// from a per-panel size and flooring at a minimum size. Re-runs whenever the
// verses change, the output mode toggles, or the window resizes.
export function useFitStageText(deps: readonly unknown[]) {
  const stageBody = useRef<HTMLDivElement>(null)
  const stageVerse = useRef<HTMLParagraphElement>(null)
  const splitPreviewBody = useRef<HTMLDivElement>(null)
  const splitPreviewVerse = useRef<HTMLParagraphElement>(null)
  const splitLiveBody = useRef<HTMLDivElement>(null)
  const splitLiveVerse = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    function fit(
      container: HTMLElement | null,
      text: HTMLElement | null,
      startSize: number,
      minSize: number,
    ) {
      if (!container || !text) return
      let fs = startSize
      text.style.fontSize = fs + 'px'

      const maxH = container.clientHeight
      if (maxH === 0) return

      const targetH = maxH * 0.92
      void text.offsetHeight

      while (text.scrollHeight > targetH && fs > minSize) {
        fs -= 1
        text.style.fontSize = fs + 'px'
        void text.offsetHeight
      }
    }

    function fitAll() {
      fit(stageBody.current, stageVerse.current, 42, 16)
      fit(splitPreviewBody.current, splitPreviewVerse.current, 28, 12)
      fit(splitLiveBody.current, splitLiveVerse.current, 28, 12)
    }

    let ro: ResizeObserver | null = null
    const raf = requestAnimationFrame(() => {
      fitAll()
      ro = new ResizeObserver(() => fitAll())
      for (const el of [stageBody.current, splitPreviewBody.current, splitLiveBody.current]) {
        if (el) ro.observe(el)
      }
      window.addEventListener('resize', fitAll)
    })

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', fitAll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { stageBody, stageVerse, splitPreviewBody, splitPreviewVerse, splitLiveBody, splitLiveVerse }
}