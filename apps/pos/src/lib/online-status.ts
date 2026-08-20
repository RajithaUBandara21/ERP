import { useEffect, useState } from "react";

/**
 * `navigator.onLine` + the online/offline events — the standard,
 * dependency-free browser signal. Known to be imperfect (a "true" false
 * positive is possible: connected to a LAN with no real internet route
 * still reports online) — acceptable for this "true foundation" phase;
 * a heartbeat/ping-based check against apps/web's own /api/health would
 * be a reasonable future improvement if this proves unreliable in
 * practice, not implemented here to avoid adding periodic network traffic
 * a foundation phase doesn't need yet.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
