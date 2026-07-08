# NagStudy 🐰

**An AI study coach that keeps students on track.**

NagStudy is a full-stack web application that pairs a task planner with an AI
coach. Students brain-dump their tasks, schedule them on a Gantt timeline, run
focus sessions with a Pomodoro timer, and get nudged — and reviewed — by an AI
coach that reads their real study data. A weekly focus leaderboard keeps them
motivated.

Built for **SWE310** as a group project.

**📁 [Demo video, slides & PDF (Google Drive)](https://drive.google.com/drive/folders/1zC2DQE7PshMviDogRIUerMrFxRYArwtq?usp=sharing)** · **🎨 [Slides on Canva](https://canva.link/1b3nj33i34700g7)**

---

## Key Features

- **AI Coach** — a two-way chat agent (Semantic Kernel + Google Gemini) that:
  - answers grounded in the student's *real* data via tool/function calls
    (tasks, focus stats, pending work) — no made-up numbers;
  - remembers past tasks, chats and user facts using **RAG** (Gemini
    embeddings + cosine-similarity retrieval);
  - **nags automatically** — daily briefing, "task starting" reminder,
    "did you finish?" check-in, and idle nudges, all context-aware;
  - generates **study reports** (focus, task completion, patterns,
    suggestions) for any period, in English or Chinese.
- **Task Planner + Gantt** — brain-dump into *Today* or *Backlog*, then drag
  tasks onto a 24-hour timeline to schedule them.
- **Yesterday's Review** — see what you finished vs. missed, and roll missed
  tasks into today.
- **Pomodoro Timer** — focus sessions, automatically logged by subject.
- **Dashboard** — today/week focus time, focus-by-subject donut, focus-by-day
  bar chart, and done/missed counts.
- **Ranking** — weekly leaderboard by total focus minutes.
- **Onboarding Tour** — a guided first-run walkthrough (intro.js).
- **Accounts & Roles** — JWT + BCrypt auth, XMU-email sign-up, and a separate
  **Admin** role for user management.

---

## Tech Stack

### Backend — `NagStudy.API` (.NET 10)

| Library | Version | Purpose |
|---|---|---|
| ASP.NET Core | 10.0 | Web API framework |
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.5 | ORM (SQL Server) |
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.5 | JWT token auth |
| BCrypt.Net-Next | 4.2.0 | Password hashing |
| Microsoft.SemanticKernel | 1.71.0 | AI orchestration (chat, tools, prompts) |
| Microsoft.SemanticKernel.Connectors.Google | 1.71.0-alpha | Google Gemini chat + embeddings |
| SQL Server | local instance | Database |

### Frontend — `NagStudy.Web` (Node.js 18+)

| Library | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| react-router-dom | 6.28.0 | Client-side routing |
| axios | 1.7.9 | HTTP client |
| recharts | 2.13.3 | Dashboard charts |
| Vite | 6 | Build tool / dev server |
| Tailwind CSS | 4 | Styling |
| @mui/material · @mui/x-date-pickers | 9 | Task time picker |
| dayjs | 1.11 | Date handling (MUI adapter) |
| gsap | 3.15 | Navigation animation |
| intro.js | 8.3 | Onboarding tour |

---

## Project Structure

```
NagStudy/
├─ NagStudy.API/            ASP.NET Core Web API (.NET 10)
│  ├─ Controllers/          Auth, Tasks, StudySessions, Categories,
│  │                        Dashboard, Ranking, Users, Admin, Coach
│  ├─ Services/             AI coach stack (Semantic Kernel), RAG,
│  │                        embeddings, JWT, auto-nag triggers
│  ├─ Plugins/              SK tools the AI calls (study analytics/context)
│  ├─ Models/Domain/        EF entities (User, StudyTask, StudySession,
│  │                        Category, ChatSession, ChatMessage, RagDocument, …)
│  ├─ Models/DTO/           Request/response DTOs (with validation)
│  ├─ Data/                 DbContext + schema init + seeders
│  └─ Program.cs            Startup: DI, JWT, CORS, seeding
└─ NagStudy.Web/            React + Vite single-page app
   └─ src/
      ├─ pages/             Landing, Login, Signup, Dashboard, Tasks,
      │                     Pomodoro, Coach, Ranking, Settings, Admin
      ├─ components/        Layout, coach UI, task popover, nav, tour
      ├─ context/           Auth, nag, tour state
      └─ api/               axios client + endpoint wrappers
```

---

## Prerequisites

- **.NET 10 SDK** — `global.json` pins a version; if `dotnet` reports a
  missing SDK, run `dotnet --list-sdks` and update `global.json` to match (or
  install the requested SDK).
- **Node.js 18+**
- **SQL Server** (LocalDB / Express / full — Windows Authentication).

---

## Getting Started

### 1. Configure secrets (backend won't start without the JWT key)

Real secrets live in **.NET user-secrets**, outside the repo. Run once, inside
`NagStudy.API/`:

```powershell
# JWT signing key (any random 32+ char value)
dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String((1..48 | % { Get-Random -Maximum 256 })))"

# Admin account password (used to seed the admin user)
dotnet user-secrets set "Admin:Password" "SWE310Admin@Team1"

# Google Gemini API key (required for the AI Coach)
dotnet user-secrets set "Gemini:ApiKey" "YOUR_GEMINI_KEY"
```

List what's set: `dotnet user-secrets list`.

### 2. Set the database server name

In `NagStudy.API/appsettings.json`, set `ConnectionStrings:DefaultConnection`
to your local SQL Server, e.g. `Server=localhost;Database=NagStudyDb;Trusted_Connection=True;TrustServerCertificate=True`.

### 3. Database

No manual EF migrations needed. On first `dotnet run`, the app creates the
schema from the model, seeds the admin + built-in coach profiles, and (in
Development) seeds demo data. To reset, drop `NagStudyDb` and run again.

### 4. Run

```powershell
# Backend — in NagStudy.API/
dotnet run                 # API at http://localhost:5178/api

# Frontend — in NagStudy.Web/ (separate terminal)
npm install                # first time only
npm run dev                # app at http://localhost:5173
```

The frontend targets `http://localhost:5178/api` (override with `VITE_API_URL`).

---

## Test Accounts

Development seeds these automatically.

### Admin

| Field | Value |
|---|---|
| Email | `swe310admin@nagstudy.app` |
| Password | `SWE310Admin@Team1` (from `Admin:Password` secret) |

### Demo students (password `Demo@1234`)

| Nickname | Email |
|---|---|
| FocusFox | `focusfox@xmu.edu.my` |
| StudyStar | `studystar@xmu.edu.my` |
| Snoozebun | `snoozebun@xmu.edu.my` |
| LazyLamb | `lazylamb@xmu.edu.my` |
| NightOwl | `nightowl@xmu.edu.my` |

**FocusFox** has the richest data — best for demoing the dashboard and ranking.

### Sign-up rules

- Email must end with `@xmu.edu.my`.
- Password: at least 8 characters, with an uppercase letter, a digit, and a
  special character.
- Passwords are stored as BCrypt hashes.

---

## Troubleshooting

- **`A compatible .NET SDK was not found … Requested SDK version 10.0.xxx`** —
  `global.json` pins an SDK version your machine doesn't have. Run
  `dotnet --list-sdks` and set `global.json`'s `version` to an installed one, or
  install the requested SDK.
- **`Failed to resolve import "..."` (frontend won't start)** — dependencies
  aren't installed. Run `npm install` in `NagStudy.Web/`.
- **Can't connect to SQL Server** — set the correct server name in
  `appsettings.json` (`ConnectionStrings:DefaultConnection`) and make sure the
  SQL Server service is running.
- **Backend exits with "JWT signing key is missing"** — set the `Jwt:Key`
  user-secret (see Getting Started).

---

## Notes

- **AI Coach requires a valid `Gemini:ApiKey`.** If Gemini is unreachable
  (e.g. a transient `503`), the coach falls back to short built-in messages so
  the app keeps working.
- **Demo data** re-seeds on each Development startup, re-anchored to the
  current date — restart the backend if the demo board looks empty.
- The Pomodoro/Gantt time logic uses Malaysia time (MYT, UTC+8); timestamps are
  stored in UTC.
