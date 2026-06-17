import { useState, useEffect, FormEvent } from "react";
import { Lock, User, Sparkles, Fingerprint, ShieldCheck, AlertCircle } from "lucide-react";
import FingerprintSensor from "./FingerprintSensor";
import { loginBiometric } from "../utils/webauthn";

interface AuthScreenProps {
  onLoginSuccess: (username: string, token: string, biometricRegistered: boolean) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isBiometricRegistered, setIsBiometricRegistered] = useState(false);
  const [showBioSensor, setShowBioSensor] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if bio is pre-registered in localStorage for quick fingerprint login
  useEffect(() => {
    const savedUser = localStorage.getItem("last_logged_username");
    const wasBioRegistered = localStorage.getItem(`bio_reg_${savedUser}`);
    if (savedUser && wasBioRegistered === "true") {
      setIsBiometricRegistered(true);
      setUsername(savedUser);
    }
  }, []);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg("נא למלא שם משתמש וסיסמא");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "שגיאה בתהליך ההרשמה");
      }

      setSuccessMsg("הרשמתך בוצעה בהצלחה! כעת תוכל להתחבר");
      setActiveTab("signin");
      setPassword("");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg("נא למלא שם משתמש וסיסמא");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "חיבור נכשל");
      }

      // Save to local storage for biometric shortcut
      localStorage.setItem("last_logged_username", data.username);
      
      onLoginSuccess(data.username, data.token, data.biometricRegistered);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Login via authenticated fingerprint simulation
  const handleBiometricLoginSuccess = async () => {
    const lastUsername = username || localStorage.getItem("last_logged_username");
    if (!lastUsername) {
      setErrorMsg("לא נמצא משתמש קודם הרשום לביומטריה");
      setShowBioSensor(false);
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      // Real WebAuthn assertion: native biometric prompt + signed challenge
      const data = await loginBiometric(lastUsername);
      onLoginSuccess(data.username, data.token, true);
    } catch (err: any) {
      setErrorMsg(err.message || "זיהוי ביומטרי נכשל");
      setShowBioSensor(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 px-4 text-right leading-relaxed text-slate-200 selection:bg-cyan-500 selection:text-slate-950" dir="rtl" id="auth_container_sec">
      
      {/* Dynamic background bubbles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-8 select-none">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-cyan-950/80 rounded-2xl border border-cyan-500 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 font-sans">
            StockWise <span className="text-cyan-400 font-medium text-lg">אלרט</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            מערכת מעקב מניות חכמה והמלצות השקעה מבוססות בינה מלאכותית
          </p>
        </div>

        {/* Biometric Scan Overlay instead of simple form if triggered */}
        {showBioSensor ? (
          <div className="p-2 animate-scale-in">
            <FingerprintSensor 
              onSuccess={handleBiometricLoginSuccess}
              onCancel={() => setShowBioSensor(false)}
              title="כניסה ביומטרית למערכת"
              subtitle={`מזהה את המשתמש ${username || "האחרון שביצע כניסה"}`}
            />
          </div>
        ) : (
          /* Custom login/register glass container */
          <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            
            {/* Tabs selector toggles */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-850 mb-8">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signin");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all
                  ${activeTab === "signin" ? "bg-slate-800 text-cyan-400 border border-slate-700 shadow-md" : "text-slate-400 hover:text-slate-200"}
                `}
              >
                כניסה לחשבון
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signup");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all
                  ${activeTab === "signup" ? "bg-slate-800 text-cyan-400 border border-slate-700 shadow-md" : "text-slate-400 hover:text-slate-200"}
                `}
              >
                הרשמה חדשה
              </button>
            </div>

            <form onSubmit={activeTab === "signin" ? handleLogin : handleRegister} className="space-y-5">
              
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-450 font-semibold block">שם משתמש (ניתן באנגלית):</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="username_inp"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="הזן שם משתמש"
                    className="w-full bg-slate-950 text-slate-100 border border-slate-850 focus:border-cyan-500 rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600 font-sans"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-450 font-semibold block">סיסמא סודית:</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="password_inp"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="הזן סיסמא"
                    className="w-full bg-slate-950 text-slate-100 border border-slate-855 focus:border-cyan-500 rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600 font-sans"
                  />
                </div>
              </div>

              {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <p>{successMsg}</p>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* Submit regular Login Action */}
              <button
                id="submit_auth_btn"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg active:scale-[0.98]"
              >
                {loading ? "מעבד פנייה..." : activeTab === "signin" ? "התחבר לחשבון" : "צור משתמש חדש"}
              </button>

              {/* Fingerprint Sign In Shortcut */}
              {activeTab === "signin" && isBiometricRegistered && (
                <div className="pt-4 border-t border-slate-850 flex flex-col items-center">
                  <button
                    id="biometric_shortcut_btn"
                    type="button"
                    onClick={() => setShowBioSensor(true)}
                    className="flex items-center justify-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors bg-cyan-950/35 border border-cyan-505/20 px-4 py-2.5 rounded-xl w-full"
                  >
                    <Fingerprint className="w-4.5 h-4.5 animate-pulse text-cyan-400" />
                    קרא והתחבר בטביעת אצבע (ביומטרי)
                  </button>
                </div>
              )}

            </form>

            <div className="mt-6 text-center">
              <p className="text-[10.5px] text-slate-500 leading-normal">
                הכניסה מאובטחת ומסווגת. האפליקציה פועלת במצב סימולציית מסחר מנוהל לטובת בדיקת סיכוני השקעות בצורה דינמית.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
