import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type CSSProperties,
} from "react";
import type { OutputState, VerseMatch } from "../../shared/types";

declare global {
  interface Window {
    scriptureCaster: {
      onOutputStateChanged: (cb: (state: OutputState) => void) => () => void;
      onAlert: (cb: (message: string) => void) => () => void;
    };
  }
}

// Background image/video layer rendered behind the verse text.
// Uses the custom bg:// protocol registered in the main process.
function BgLayer({
  state,
  style,
}: {
  state: OutputState;
  style: CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (state.background?.type === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [state.background]);

  if (!state.background) return null;

  const src = `bg://${state.background.fileName}`;

  if (state.background.type === "image") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          ...style,
        }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        ...style,
      }}
    />
  );
}

// Displays a verse with auto-fitting text. Starts at 90px and shrinks
// 1px at a time until the text fits inside the container (floor 24px).
// Also handles real-time re-fitting on resize via ResizeObserver.
function VerseDisplay({
  verse,
  textShadow,
}: {
  verse: VerseMatch;
  textShadow?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    function fitText() {
      if (!container || !text) return;

      // Start with a large base size
      let fs = 90;
      text.style.fontSize = fs + "px";

      const maxH = container.clientHeight;
      if (maxH === 0) return;

      // Only shrink if it overflows the HEIGHT
      while (container.scrollHeight > maxH && fs > 24) {
        fs -= 1;
        text.style.fontSize = fs + "px";
      }
    }

    fitText();
    const observer = new ResizeObserver(() => {
      fitText();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [verse]);

  const base: CSSProperties = {
    fontFamily: "'Fraunces', Georgia, serif",
    fontWeight: 500,
    lineHeight: 1.4,
    textAlign: "center",
    margin: 0,
    overflowWrap: "break-word",
    wordBreak: "break-word",
    fontSize: "90px",
  };
  if (textShadow) base.textShadow = textShadow;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: "5%",
        boxSizing: "border-box",
      }}
    >
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <p ref={textRef} style={base}>
          {verse.text}
        </p>
      </div>

      <div
        style={{
          flexShrink: 0,
          marginTop: "2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "24px",
            letterSpacing: "0.1em",
            color: "#93a9ff",
            margin: 0,
            textShadow: "0 1px 6px rgba(0,0,0,0.5)",
          }}
        >
          {verse.book.toUpperCase()} {verse.chapter}:{verse.verse} ·{" "}
          {verse.translation}
        </p>
      </div>
    </div>
  );
}

// Main output window. Renders one of several layouts depending on state:
//   - blankMode "black" → solid black screen
//   - blankMode "logo" → logo splash
//   - background active  → verse overlaid on bg image/video
//   - no verse / not live → transparent (hidden)
//   - default            → verse on dark background
export default function App() {
  const [state, setState] = useState<OutputState>({
    live: false,
    verse: null,
    blankMode: "none",
    background: null,
  });
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => window.scriptureCaster.onOutputStateChanged(setState), []);
  useEffect(() => {
    const unsub = window.scriptureCaster.onAlert((msg) => {
      setAlertMsg(msg);
      setTimeout(() => setAlertMsg(null), 6000);
    });
    return unsub;
  }, []);

  const base: CSSProperties = {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
    overflow: "hidden",
  };

  if (state.blankMode === "black") {
    return <div style={{ ...base, background: "#000" }} />;
  }

  if (state.blankMode === "logo") {
    return (
      <div style={{ ...base, background: "#0a0b0f" }}>
        <p
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: "3vw",
            color: "#93a9ff",
          }}
        >
          Scripture Caster
        </p>
      </div>
    );
  }

  if (state.background) {
    return (
      <div style={{ ...base, background: "#0a0b0f", color: "#f1f2f7" }}>
        <BgLayer state={state} style={{ zIndex: 0 }} />
        {state.live && state.verse && (
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              height: "100%",
            }}
          >
            <VerseDisplay
              verse={state.verse}
              textShadow="0 2px 12px rgba(0,0,0,0.6)"
            />
          </div>
        )}
        {alertMsg && (
          <div style={alertBarStyle}>{alertMsg}</div>
        )}
      </div>
    );
  }

  if (!state.live || !state.verse)
    return (
      <div
        style={{ background: "transparent", width: "100vw", height: "100vh" }}
      />
    );

  return (
    <div style={{ ...base, background: "#0a0b0f", color: "#f1f2f7" }}>
      <VerseDisplay verse={state.verse} />
      {alertMsg && (
        <div style={alertBarStyle}>{alertMsg}</div>
      )}
    </div>
  );
}

const alertBarStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  background: "#e74c3c",
  color: "#fff",
  padding: "14px 20px",
  fontSize: "18px",
  fontWeight: 600,
  textAlign: "center",
  fontFamily: "'Inter', sans-serif",
};
