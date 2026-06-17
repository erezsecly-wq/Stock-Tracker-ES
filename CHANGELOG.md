# Change Log — שדרוג אבטחה + מנוע מסחר אמיתי

## 17/06/2026 — אבטחה, persistence, ומנוע מסחר 24/7

### אבטחה (כל הממצאים הקריטיים תוקנו)
- **תוקן: עקיפת אימות מוחלטת.** הוחלף פירוק הטוקן השבור באימות JWT אמיתי עם middleware (`authMiddleware`) שמאמת חתימה בכל בקשה. נבדק: טוקן מזויף מחזיר כעת `401` (לפני כן החזיר נתוני משתמש).
- **תוקן: סיסמאות בטקסט גלוי.** הוחלף ב-`bcrypt` (hash + salt, 12 rounds). השוואה בזמן קבוע למניעת user-enumeration.
- **תוקן: "ביומטריה" מזויפת.** מומש **WebAuthn אמיתי** (`@simplewebauthn`) — challenge/signature מול מפתח ציבורי, גם בשרת וגם ב-frontend (`src/utils/webauthn.ts`).
- **הוסף:** rate limiting על endpoints של אימות (`express-rate-limit`), ולידציית קלט לשם משתמש וסיסמה.
- **תוקן:** `data_store.json` נוסף ל-`.gitignore` (מונע דליפת נתונים לגיט).
- **תוקן: race condition.** DB יחיד בזיכרון כמקור אמת + כתיבה אטומית (tmp+rename) מדורגת. שמירה בטוחה גם ב-SIGINT/SIGTERM.

### מנוע מסחר אמיתי 24/7 (קנייה/מכירה אמיתיים)
- מנוע אוטונומי **בצד השרת** (`runTradingEngine`) שרץ בכל tick, מבצע קנייה/מכירה פר משתמש, ושומר הכול לדיסק — רץ גם כשהדפדפן סגור.
- ניהול סיכונים: **Stop-Loss**, **Take-Profit**, ו-**position sizing** לפי אחוז מההון (במקום כמות קבועה).
- **מדדי ביצוע אמיתיים** (`/api/bot/metrics`): תשואה כוללת, תשואה מול benchmark (קנה-והחזק), אחוז הצלחה, max drawdown, Sharpe, מספר עסקאות.
- API חדש: `/api/bot`, `/api/bot/config`, `/api/bot/start`, `/api/bot/stop`, `/api/bot/metrics`.
- ממשק חדש: טאב **"🟢 בוט מסחר 24/7 (שרת)"** (`src/components/ServerBot.tsx`) — הגדרה, הפעלה/עצירה, אחזקות, עסקאות ומדדים בזמן אמת.

### דיפלוי
- `Dockerfile`, `.dockerignore`, `render.yaml` (כולל דיסק קבוע), `.env.example` מעודכן, ו-`DEPLOY.md` (מדריך מלא בעברית).

### סטטוס
- ✅ `tsc --noEmit` נקי · ✅ `npm run build` מצליח · ✅ נבדק בריצה: bypass נסגר, bcrypt עובד, הבוט מבצע ושומר עסקאות.
- נקודת שחזור: ענף git `backup-baseline` (מצב לפני השינויים).
