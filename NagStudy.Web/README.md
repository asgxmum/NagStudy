# NagStudy — Frontend (React + Vite)

Real React frontend, built in the **lecturer's structure** (W4 Vite · W5 Tailwind · W6 Axios · W7 Recharts + React Router). Ported from the `NagStudy.html` prototype.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
```
Backend: set the API base in a `.env` file → `VITE_API_URL=http://localhost:<your-api-port>/api`
(default `http://localhost:5265/api`). Run the ASP.NET Core API (see design doc §8.2 / the W9 JWT tutorial) so login + data work.

## Structure
```
src/
  main.jsx            # createRoot + BrowserRouter + AuthProvider (W4/W7)
  App.jsx             # Routes (W7): /, /login, /signup, /app/* (nested), /admin
  index.css           # @import "tailwindcss" + @theme brand tokens (W5)
  context/AuthContext.jsx   # JWT + user in localStorage (§8.2)
  components/
    AppLayout.jsx     # student-app sidebar shell + <Outlet/>
    ProtectedRoute.jsx# JWT/role route guard (§8.1)
    ScreenStub.jsx    # temp placeholder
  api/
    client.js         # axios instance + Bearer-token interceptor (W6 + §8.2)
    auth.js           # login / register
  pages/
    LandingPage · LoginPage · SignupPage
    Dashboard · Tasks · Pomodoro · Coach · Ranking · Settings   (under /app)
    AdminDashboard
```

## Status (incremental port)
- ✅ Foundation: Vite + Tailwind + Router + Axios + JWT auth flow (localStorage, role routing)
- ✅ **LoginPage** fully ported (reference pattern: controlled form → Axios → store token → role redirect)
- ⏳ TODO: port each screen body from `NagStudy.html` (Landing, Signup, Dashboard, Tasks, Pomodoro, Coach, Ranking, Settings, Admin) — replace the `ScreenStub`s one at a time.

## Convention (team)
- Components in `src/components/`, pages in `src/pages/`, API calls in `src/api/<resource>.js` (async, `try/catch`, `return res.data`).
- Lists: `.map()` with `key`. Forms: controlled inputs + `onSubmit`/`preventDefault`.
- Tailwind utilities + brand tokens (`bg-coral`, `text-navy`, `font-display`, …) from `@theme` in `index.css`.
