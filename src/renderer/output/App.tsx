import { useEffect, useRef, useState } from "react";
import type { OutputState } from "../../shared/types";
import { SlideMonitor } from "../shared/slide";

function BgLayer({
  state,
  style,
}: {
  state: OutputState;
  style: React.CSSProperties;
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
        className="bg-layer"
        style={{
          backgroundImage: `url(${src})`,
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
      className="bg-video"
      style={style}
    />
  );
}

export default function App() {
  const [state, setState] = useState<OutputState>({
    live: false,
    slide: null,
    theme: "default",
    layout: "single",
    fontSize: null,
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

  if (state.blankMode === "black") {
    return <div className="out-root black-screen" />;
  }

  if (state.blankMode === "logo") {
    return (
      <div className="out-root logo-screen">
        <p className="logo-name">Scripture Caster</p>
      </div>
    );
  }

  return (
    <div
      className={
        "out-root" +
        (state.background ? " has-bg" : "") +
        (!state.live || !state.slide ? " idle" : "")
      }
    >
      <BgLayer state={state} style={{ zIndex: 0, position: "absolute", inset: 0 }} />
      <div className="out-stage" style={{ zIndex: 1 }}>
        <SlideMonitor
          className="out-monitor"
          slide={state.live ? state.slide : null}
          fontSize={state.fontSize}
          emptyText=""
        />
      </div>
      {alertMsg && <div className="alert-bar">{alertMsg}</div>}
    </div>
  );
}