# StockWise ES — מדריך הרצה 24/7 ודיפלוי

המערכת מוכנה כעת לרוץ אוטונומית 24/7: מנוע המסחר רץ בצד השרת, מבצע קנייה/מכירה בכל tick, ושומר הכול לדיסק — כך שאפשר להשאיר אותו 60 יום ולחזור לתוצאות אמיתיות.

## הרצה מקומית

```bash
npm install
cp .env.example .env       # ערוך והכנס GEMINI_API_KEY + JWT_SECRET
npm run dev                # פיתוח (Vite + שרת)
```

לבדיקת פרודקשן מקומית:

```bash
npm run build
npm start                  # מריץ את dist/server.cjs
```

## משתני סביבה (env)

| משתנה | חובה | תיאור |
|--------|------|--------|
| `JWT_SECRET` | ✅ בפרודקשן | מחרוזת אקראית ארוכה לחתימת טוקנים. בלי זה — הטוקנים מתאפסים בכל הפעלה. |
| `GEMINI_API_KEY` | לניתוחי AI | מפתח Gemini (מנוהל בצד השרת בלבד, לא נחשף ללקוח). |
| `RP_ID` | ל-WebAuthn | הדומיין **בלי** סכמה/פורט. מקומי: `localhost`. בפרוד: `myapp.onrender.com`. |
| `ORIGIN` | ל-WebAuthn | ה-origin המלא כולל `https://`. **חייב HTTPS בפרודקשן.** |
| `PORT` | לא | ברירת מחדל 3000 (שירותי אירוח מזריקים אוטומטית). |
| `DB_FILE` | מומלץ בפרוד | נתיב לקובץ הנתונים — יש להצביע על **דיסק קבוע** כדי שלא יימחק בכל deploy. |

> חשוב ל-WebAuthn: זיהוי ביומטרי (טביעת אצבע/פנים) עובד רק על `localhost` או על **HTTPS**. ב-HTTP רגיל בדומיין מרוחק הדפדפן יחסום אותו.

## דיפלוי ל-Render (מומלץ — כולל דיסק קבוע)

הקובץ `render.yaml` כבר מוכן. שלבים:

1. דחוף את הקוד ל-GitHub.
2. ב-Render: **New → Blueprint**, בחר את הריפו. Render יקרא את `render.yaml`.
3. הגדר את המשתנים המסומנים `sync: false`: `RP_ID`, `ORIGIN`, `GEMINI_API_KEY`.
   - `RP_ID` = הדומיין של השירות (למשל `stockwise-es.onrender.com`).
   - `ORIGIN` = `https://stockwise-es.onrender.com`.
4. Deploy. הדיסק הקבוע (`/var/data`) שומר את `data_store.json` בין דיפלויים.

> בחר תוכנית בתשלום (`starter` ומעלה) — התוכנית החינמית "נרדמת" בחוסר פעילות ולא מתאימה לריצת 24/7.

## דיפלוי עם Docker (כל VPS / Railway / Fly.io)

```bash
docker build -t stockwise-es .
docker run -d --restart=always -p 3000:3000 \
  -e JWT_SECRET="<secret>" \
  -e GEMINI_API_KEY="<key>" \
  -e RP_ID="yourdomain.com" \
  -e ORIGIN="https://yourdomain.com" \
  -e DB_FILE="/data/data_store.json" \
  -v stockwise_data:/data \
  stockwise-es
```

ה-volume (`-v`) חיוני כדי שהנתונים והעסקאות יישמרו.

## שימוש בבוט ה-24/7

1. היכנס למערכת → טאב **"🟢 בוט מסחר 24/7 (שרת)"**.
2. הגדר אסטרטגיה: הון התחלתי, גודל פוזיציה (% מההון), Stop-Loss, Take-Profit, וספי קנייה/מכירה לכל מניה.
3. לחץ **"הפעל בוט"** — מהרגע הזה הבוט סוחר אוטומטית בצד השרת, גם כשהדפדפן סגור.
4. חזור מתי שתרצה כדי לראות עסקאות, אחזקות, ומדדי ביצוע (תשואה מול קנה-והחזק, אחוז הצלחה, Sharpe, max drawdown).

> טיפ: לתוצאות אמיתיות הפעל את ה-Live Feed (Yahoo Finance) כדי שהבוט יסחר על מחירי שוק אמיתיים ולא על סימולציה.
