import { useState, useEffect } from "react";
import { Fingerprint, CheckCircle, ShieldAlert } from "lucide-react";

interface FingerprintSensorProps {
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
}

export default function FingerprintSensor({
  onSuccess,
  onCancel,
  title = "אימות טביעת אצבע",
  subtitle = "אנא הנח את האצבע על הסורק לזיהוי מהיר"
}: FingerprintSensorProps) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");

  // Play custom synth audio feedback
  const playBeep = (freq: number, type: OscillatorType, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context might be blocked by browser first-touch policies, ignore gracefully
    }
  };

  const handleScan = () => {
    if (scanning || status === "success") return;

    setScanning(true);
    setStatus("scanning");
    playBeep(440, "sine", 0.1);

    // Simulate scanning delay
    setTimeout(() => {
      // Simulate high success rate
      const successful = true; 
      if (successful) {
        setStatus("success");
        setScanning(false);
        playBeep(880, "sine", 0.15);
        setTimeout(() => playBeep(1200, "sine", 0.2), 100);
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setStatus("error");
        setScanning(false);
        playBeep(220, "sawtooth", 0.3);
        setTimeout(() => {
          setStatus("idle");
        }, 2000);
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full mx-auto text-center" id="fingerprint_sec">
      <h3 className="text-xl font-bold text-slate-100 tracking-tight font-sans mb-1">{title}</h3>
      <p className="text-sm text-slate-400 mb-8 max-w-xs">{subtitle}</p>

      {/* Animated Sensor Area */}
      <div 
        onClick={handleScan}
        className={`relative w-36 h-36 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 select-none
          ${status === "scanning" ? "bg-cyan-950/40 border-2 border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-pulse" : ""}
          ${status === "success" ? "bg-emerald-950/40 border-2 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)]" : ""}
          ${status === "error" ? "bg-rose-950/40 border-2 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.3)]" : ""}
          ${status === "idle" ? "bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 shadow-md hover:shadow-cyan-900/30 hover:border-slate-600" : ""}
        `}
      >
        {/* Laser line animation during active scan */}
        {status === "scanning" && (
          <div className="absolute left-0 right-0 h-0.5 bg-cyan-400 opacity-80 shadow-[0_0_10px_#06b6d4] animate-bounce z-10" style={{ animationDuration: '2s' }} />
        )}

        {/* Dynamic Concentric Waves */}
        {status === "scanning" && (
          <>
            <span className="absolute animate-ping inline-flex h-28 w-28 rounded-full bg-cyan-500 opacity-20"></span>
            <span className="absolute animate-ping inline-flex h-32 w-32 rounded-full bg-cyan-500 opacity-10" style={{ animationDelay: '0.4s' }}></span>
          </>
        )}

        {/* Icon State display */}
        {status === "success" ? (
          <CheckCircle className="w-16 h-16 text-emerald-400 transition-transform scale-110 duration-300" />
        ) : status === "error" ? (
          <ShieldAlert className="w-16 h-16 text-rose-400" />
        ) : (
          <Fingerprint className={`w-16 h-16 transition-all duration-300
            ${status === "scanning" ? "text-cyan-400 scale-95" : "text-slate-300"}
          `} />
        )}
      </div>

      {/* Live Helper text status */}
      <div className="mt-8 min-h-[24px]">
        {status === "scanning" && (
          <span className="text-xs font-mono text-cyan-400 animate-pulse tracking-widest uppercase">
            סורק טביעת אצבע... 24%... 78%...
          </span>
        )}
        {status === "success" && (
          <span className="text-xs font-semibold text-emerald-400 tracking-wide">
            זיהוי ביומטרי הושלם בהצלחה!
          </span>
        )}
        {status === "error" && (
          <span className="text-xs font-semibold text-rose-400">
            הסריקה נכשלה. אנא נסה שנית
          </span>
        )}
        {status === "idle" && (
          <span className="text-xs text-slate-500">
            לחץ על הסורק כדי להתחיל
          </span>
        )}
      </div>

      {onCancel && (
        <button 
          onClick={onCancel}
          className="mt-6 text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-4"
        >
          חזור להתחברות רגילה
        </button>
      )}
    </div>
  );
}
