import { useEffect, useRef, useState } from "react";
import { getPendingOrders } from "../services/pendingOrdersService";

export default function useOrderNotifications(currentPath) {
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef(null);
  const seen = useRef(null);
  const refresh = useRef(null);

  function chime() {
    const context = audio.current;
    if (!context || context.state !== "running") return;
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.18;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
  }

  async function toggleSound() {
    if (soundEnabled) {
      await audio.current?.suspend();
      setSoundEnabled(false);
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Este navegador no permite activar el sonido.");
      audio.current ||= new AudioContext();
      await audio.current.resume();
      setSoundEnabled(true);
      setError("");
      chime();
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    let disposed = false;
    let busy = false;
    async function check() {
      if (busy) return;
      busy = true;
      try {
        const pending = await getPendingOrders();
        if (disposed) return;
        const incoming = seen.current === null ? [] : pending.filter((order) => !seen.current.has(order.id));
        seen.current ||= new Set();
        pending.forEach((order) => seen.current.add(order.id));
        setPendingCount(pending.length);
        setError("");
        if (incoming.length) {
          setToast(incoming.length === 1
            ? `Nuevo pedido #${incoming[0].order_number} · ${incoming[0].customer_name}`
            : `Llegaron ${incoming.length} pedidos nuevos`);
          chime();
          window.dispatchEvent(new Event("koven:new-orders"));
        }
      } catch { if (!disposed) setError("No se pudieron actualizar los avisos de pedidos. Reintentando…"); }
      finally { busy = false; }
    }
    refresh.current = check;
    check();
    const interval = window.setInterval(check, 15000);
    window.addEventListener("focus", check);
    window.addEventListener("koven:orders-updated", check);
    return () => {
      disposed = true;
      refresh.current = null;
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("koven:orders-updated", check);
    };
  }, []);

  useEffect(() => { refresh.current?.(); }, [currentPath]);
  useEffect(() => () => { audio.current?.close(); }, []);
  return { pendingCount, toast, dismissToast: () => setToast(null), soundEnabled, toggleSound, error };
}
