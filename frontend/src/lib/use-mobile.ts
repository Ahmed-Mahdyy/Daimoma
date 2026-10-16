import { useEffect, useState } from "react";

/** True below the Tailwind `md` breakpoint (768px) — matches `max-md:` classes. */
export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767.98px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767.98px)");
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
