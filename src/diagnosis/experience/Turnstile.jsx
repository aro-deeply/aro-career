import React, { useEffect, useRef } from "react";

const SITE_KEY = "0x4AAAAAADFpsfyi_rcbyT0P";

// Cloudflare 봇 확인 위젯. diagnosis.html이 이미 스크립트를 불러온다.
export default function Turnstile({ onToken }) {
  const box = useRef(null);
  const widget = useRef(null);
  useEffect(() => {
    let cancelled = false;
    function mount() {
      if (cancelled) return;
      if (window.turnstile && box.current && !widget.current) {
        widget.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          callback: token => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      } else if (!widget.current) setTimeout(mount, 250);
    }
    mount();
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) { try { window.turnstile.remove(widget.current); } catch { /* already gone */ } }
    };
  }, [onToken]);
  return <div ref={box} className="xp-turnstile" />;
}
