# NagStudy 🐰

AI 唠叨学习管家 + 大学排行榜。把任务一股脑写下来，拖到甘特时间轴上，用番茄钟专注，
被你选的 AI 教练用对应语气唠叨，然后在全校专注排行榜上往上爬。

**技术栈：** React + Vite + Axios + Tailwind（前端）· ASP.NET Core 10 Web API + EF Core +
SQL Server（后端）· JWT + BCrypt 认证。

```
NagStudy/
├─ NagStudy.API/   ASP.NET Core Web API (.NET 10)
├─ NagStudy.Web/   React + Vite 单页应用
└─ README.md       ← 这一个文件就够了（设置 + 账号 + 进度 + 剩余任务 + 该读哪些文件）
```

---

## 🧰 框架与依赖版本

> 写报告 / 答辩要用，统一列在这里。

### 后端（NagStudy.API）— .NET 10

| 框架 / 库 | 版本 | 用途 |
|---|---|---|
| .NET SDK | 10.0.x（目标框架 `net10.0`） | 运行时 / 编译目标 |
| ASP.NET Core | 10.0 | Web API 框架 |
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.5 | ORM（用 C# 操作 SQL Server） |
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.5 | JWT 令牌验证 |
| Microsoft.AspNetCore.OpenApi | 10.0.5 | OpenAPI / Swagger 文档 |
| **BCrypt.Net-Next** | **4.2.0** | **密码哈希（BCrypt）** |
| SQL Server | —（本地实例） | 数据库 |

### 前端（NagStudy.Web）— Node.js 18+

| 框架 / 库 | 版本 | 用途 |
|---|---|---|
| React | 18.3.1 | UI 框架 |
| react-dom | 18.3.1 | 把 React 渲染到 DOM |
| react-router-dom | 6.28.0 | 前端路由 |
| axios | 1.7.9 | HTTP 请求（调后端 API） |
| recharts | 2.13.3 | 图表（仪表盘统计） |
| Vite | 6.0.5 | 构建工具 / 开发服务器 |
| tailwindcss | 4.0.0 | CSS 框架 |
| @tailwindcss/vite | 4.0.0 | Tailwind 的 Vite 插件 |
| @vitejs/plugin-react | 4.3.4 | Vite 的 React 插件 |

> 后端版本来自 `NagStudy.API/NagStudy.API.csproj`，前端版本来自 `NagStudy.Web/package.json`，
> 以这两个文件为准（`package.json` 里的 `^` 表示「兼容的最低版本」）。

---

## ✅ 环境要求

- **.NET 10 SDK**
- **Node.js 18+**（前端）
- **SQL Server**（LocalDB / Express / 完整版都行，Windows 身份验证可连）

---

## ⚙️ 第一次设置（每个人都要做，很重要）

### 1. 设置 user-secrets（不设置后端起不来）

真正的密钥**不在** `appsettings.json` 里（所以不会被提交到 GitHub），而是放在
**.NET user-secrets**，存在你自己电脑、仓库外面。**没设置 JWT 密钥后端就启动不了。**
每个人**做一次**：

```powershell
# 在 NagStudy.API/ 目录下

# 1) JWT 签名密钥 —— 自己生成一个随机的 32+ 字符值（每台机器各自一个，不用和别人一样）：
dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String((1..48 | % { Get-Random -Maximum 256 })))"

# 2) 管理员密码 —— 用团队统一值，这样种子管理员能登录（见下方「账号」）：
dotnet user-secrets set "Admin:Password" "SWE310Admin@Team1"
```

> 查看已设置的：`dotnet user-secrets list`
> 跳过第 1 步：后端启动时会停下并提示你正是这条命令。
> 跳过第 2 步：app 还能跑，但不会创建管理员账号。

### 2. 修改 `appsettings.json` 里的连接字符串服务器名

默认是 `Server=AngelLee; Database=NagStudyDb`（Windows 身份验证，无密码）。
**把 `AngelLee` 改成你自己电脑的 SQL Server 名**，否则连不上数据库。
这一行每台机器都不一样，**改完别提交覆盖别人的**。

### 3. 数据库

**不需要 `dotnet ef` 迁移。** 第一次 `dotnet run` 时，app 会根据 `NagStudyContext` 里的实体**自动建表**（`EnsureCreated`），并写入管理员 + 内置 Coach 配置；Development 环境还会生成演示数据（幂等，已存在会跳过）。

新增表：在 `Models/Domain/` 加实体 → `NagStudyContext` 加 `DbSet` → **删掉旧库或换库名** → 再 `dotnet run` 即可。

想清空重来：在 SSMS 里删除 `NagStudyDb`（或 `DROP DATABASE NagStudyDb`），再运行 app。

### 4. 运行

```powershell
# 后端 —— 在 NagStudy.API/
dotnet run                # API 默认 https://localhost:5178/api

# 前端 —— 在 NagStudy.Web/（另开一个终端）
npm install               # 仅第一次
npm run dev               # 前端 http://localhost:5173
```

前端的 API 地址是 `http://localhost:5178/api`（可用 `VITE_API_URL` 覆盖）。

---

## 🌿 Git 协作流程（非常重要，所有人必读）

> ⚠️⚠️ **最重要的一条：不要自己把你的分支合并（merge）到 `main`！**
> `main` 是大家共享的稳定分支。合进 main 必须通过 GitHub 的 **Pull Request + 至少一个人 review**，
> 由组长统一合。**不要自己点 merge，也不要直接在 `main` 上改代码 / commit / push。**

### 第一次克隆

```powershell
git clone https://github.com/asgxmum/NagStudy.git
cd NagStudy
# 然后按上面「第一次设置」做：user-secrets + 改连接字符串服务器名
```

### 每次开始干活：先更新 main，再开自己的分支

```powershell
git checkout main
git pull origin main             # 先拿到最新的 main
git checkout -b feat/你的任务     # 在自己的新分支上干活，别在 main 上改
```

分支命名建议：

- 同学 A：`feat/pomodoro-clock`
- 同学 B：`feat/coach-realdata`
- 同学 C：`feat/admin`

### 提交 + 推送（只推到你自己的分支）

**commit message 一律用 `名字-改了什么-日期` 格式**，例如 `LZH-番茄钟秒数修复-6.18`。

```powershell
git add .
git commit -m "LZH-番茄钟秒数修复-6.18"          # 名字-改了什么-日期
git push -u origin feat/你的任务                 # 推到你自己的分支，不是 main
```

> 📌 **push 之前别忘了**：在下面的「📝 变更记录」里加一条，写清楚你**改了什么、遇到什么报错 /
> 为什么这么改、还有什么没解决**。**这条很重要 —— 不写不要 push。**

### 合并到 main 的**正确**方式

1. 在 GitHub 上对你的分支开一个 **Pull Request**（base = `main`，compare = 你的分支）。
2. 组里至少一个人 **review**。
3. review 通过后，由 **组长在 GitHub 上点 Merge**。
4. ❌ **你自己不要在本地 `git merge` 进 main 再 push。**

### 别人合了 main 之后，更新你的分支

```powershell
git checkout feat/你的任务
git pull origin main             # 把最新 main 合进你的分支（不是反过来！）
# 解决冲突 → commit
```

### ⚠️ 其它注意

- **不要提交 `bin/` `obj/` `node_modules/` `dist/`** —— 根目录 `.gitignore` 已经挡住，别强加。
- **不要提交你本地改过的连接字符串服务器名**（`appsettings.json` 那一行每台机器不一样）。
  不小心改了又不想交：`git checkout -- NagStudy.API/appsettings.json` 还原再 commit。
- **user-secrets 不会被提交**（它本来就在仓库外，放心）。
- commit message 一律用 `名字-改了什么-日期` 格式（见上）。

---

## 📝 变更记录（每次改完都要写，非常重要）

> 每个人改完代码、**push 之前**，在这里**加一条**。每条都要写清楚这三点：
> **① 改了什么 ② 遇到什么报错 / 为什么这么改 ③ 还有什么没解决**。
> 这样组员 review 和接手时一眼就懂，也方便定位谁在什么时候改了什么。最新的写最上面。

### 6.16 · LZH

- **改了什么**：后端稳定性（claim 解析 / 全局异常 / register 竞态）、DTO 校验 + 日期解析、
  前端错误处理（Tasks 回滚 + Remember me）、落地页打磨、JWT 移入 user-secrets。详见上方「已完成」。
- **遇到的报错 / 为什么改**：畸形 token 会直接 500 并泄露堆栈 → 加 `TryParse` + 全局异常处理；
  Tasks 保存失败时 UI 假装成功、输入还会丢 → 加回滚 + ⚠️ toast；JWT 密钥以明文提交进仓库 →
  移到 user-secrets，有效期也从 30 天改成 120 分钟。
- **还没解决的**：我的部分都完成了。剩番茄钟时钟（同学 A）、Coach 真数据（同学 B）、
  Admin（同学 C），见下方「剩余任务」。

### 6.23 · ZZY（后端 C1）

- **改了什么**：完成 Admin **后端接口（C1）**。新增 `AdminController.cs`（`GET /api/admin/users` 用户列表 + `PUT /api/admin/users/{id}/status` 状态更新），新增 `AdminUserResponse` / `UpdateStatusRequest` DTO，带 `[Authorize(Roles="Admin")]` 角色保护、本人排除、其他管理员保护。
- **遇到的报错 / 为什么改**：`User.Status`（`Active/Banned/Deleted`）和 `Role` 字段早就有，但没有任何接口能修改它们 → 补上管理员用户管理接口，满足作业后台管理要求。删除采用软删除（`status="Deleted"`），与设计 §9.3 一致。
- **还没解决的**：⚠️ **本人只负责后端（C1）。前端没有改动** —— `AdminDashboard.jsx` 仍是 mock（用 `seedUsers`，封禁/删除只改本地 state），**C2（前端对接真实 API）仍待前端同学完成**（注意：mock 字段是 `nick`，后端返回的是 `nickname`，对接时要改）。

> *LZH 订正（6.23）：原记录写「C1 & C2 完成、前端已接入真实 API」，但本次 commit 实际未包含任何前端改动（`AdminDashboard.jsx` 与初始版完全一致），故更正为「仅后端 C1」，避免团队误以为 C2 已完成。*

### 6.23 · LZH（补充文档）

- **改了什么**：在「剩余任务 → 同学 C → C2」补充了 **Admin 用户管理的状态行为规范**（Ban/Unban 只在 Active↔Banned；Delete=软删除后从列表消失；Deleted 不可被 Ban/Unban 复活），并补上 `nick`→`nickname` 字段对齐说明。
- **遇到的报错 / 为什么改**：admin 前端同学发现「`Deleted` 用户点 Ban/Unban 后又变回 `Active`」，问是不是预期 —— 不是，是行为没写清楚导致的歧义。补上规范避免再踩坑。
- **还没解决的**：规范只是文档；按规范实际改 `AdminDashboard.jsx` 待 admin 前端同学完成（已在 6.25 由 ZK 完成）。

### 6.25 · ZK (前端C2)
- **改了什么**：完成了 Admin 前端的真实 API 对接（C2 任务），并在后端补充了 `GET /api/admin/stats` 接口以实现真实数据看板联动。全面移除了所有 Mock 数据，将表格字段从 `nick` 修正为真实的 `nickname`。
- **遇到的报错 / 为什么改**：联调时发现“软删除”的用户点击 Ban 会触发状态机 Bug 重新变回 Active。根据最新规范，在前端获取列表时增加了 `filter(u => u.status !== "Deleted")` 进行过滤，成功解决问题。为满足大作业 Rubric 对真实 Dashboard 数据的硬性要求，额外补齐了后端的统计接口。
- **还没解决的**：Admin 模块（C1 & C2）已全面完工并 100% 遵守行为规范，目前暂无发现遗留问题。

### 6.25 · LZH（合并记录）

- **改了什么**：把两位同学的 Admin 分支都合并进了 `main`，目前 `main` 已是完整可运行版本。
  - **ZZY（后端 C1）** `feat/admin-backend` → 已合并进 `main`（PR #1）。
  - **ZK（前端 C2 + 后端 Stats）** `feat/admin-frontend` → 已合并进 `main`（PR #2，合并时解决了 README 变更记录冲突）。
- **遇到的报错 / 为什么改**：PR #2 合并时 README「变更记录」处有冲突（ZK 的 6.25 与 LZH 的 6.23 加在同一位置）—— 已保留两条、按时间排序解决。另：本地实测时遇到 `5178 address already in use`，原因是 zip 文件夹（`NagStudy-feat-admin-frontend`）里残留的旧后端进程占用端口，杀掉即可，与代码无关。
- **已验证**：`main` 后端 `dotnet build` 0 警告 0 错误；本地启动后用 admin 账号登录、`/admin/stats`、`/admin/users`、Ban/Unban/Delete 均正常。
- **还没解决的**：暂无。请大家 `git pull origin main` 拿最新版；以后**别在 zip 文件夹里运行**，统一在 `d:\...\NagStudy\` 主仓库里跑。

### 📋 模板（复制这段写你自己的）

```
### 日期 · 你的名字
- 改了什么：
- 遇到的报错 / 为什么改：
- 还没解决的：
```

---

## 📁 文件结构与用途

### 后端 `NagStudy.API/`

```
NagStudy.API/
├─ Program.cs                       启动入口：DI、JWT 认证、CORS、全局异常、种子数据
├─ appsettings.json                 配置（连接字符串、JWT Issuer/Audience/有效期）；密钥在 user-secrets
├─ Controllers/                     API 接口（每个对应一组 /api/... 路由）
│  ├─ AuthController.cs             注册 / 登录（发 JWT）
│  ├─ TasksController.cs            任务 CRUD + 甘特图（?date= 过滤）
│  ├─ StudySessionsController.cs    番茄钟专注记录
│  ├─ CategoriesController.cs       分类（颜色）
│  ├─ DashboardController.cs        仪表盘统计（今日 / 本周 / 分类占比）
│  ├─ RankingController.cs          排行榜
│  ├─ UsersController.cs            我的资料 / 改密码 / 改教练语气
│  └─ AdminController.cs            后台用户管理：列表 + 状态(封禁/删除)（ZZY 后端 C1）
├─ Models/
│  ├─ Domain/                       数据库实体（EF 映射成表）
│  │  └─ User / StudyTask / StudySession / Category / AIFeedback
│  └─ DTO/                          请求/响应数据结构（带校验注解）
│     └─ RegisterRequest / LoginRequest / AuthResponse / TaskRequest /
│        CategoryRequest / StudySessionRequest / ChangePasswordRequest /
│        UpdateProfileRequest / UpdateToneRequest
├─ Data/
│  ├─ NagStudyContext.cs            EF DbContext（DbSet + 唯一索引 + 外键关系）
│  ├─ DatabaseInitializer.cs        启动建表（EnsureCreated）+ 管理员种子
│  ├─ ProfileSeeder.cs              内置 Coach 人设
│  └─ DemoSeeder.cs                 开发环境演示数据（5 个学生 + 任务 + 专注记录）
├─ Services/
│  └─ TokenService.cs               生成 JWT（写入 Sub/Email/Role/nickname claim）
├─ Extensions/
│  └─ ClaimsPrincipalExtensions.cs  从 token 安全取 userId（LZH 新增）
├─ Infrastructure/
│  └─ GlobalExceptionHandler.cs     全局异常 → 干净的 401/500（LZH 新增）
```

### 前端 `NagStudy.Web/`

```
NagStudy.Web/
├─ index.html                       页面入口
├─ vite.config.js                   Vite 配置
├─ public/                          静态图片（logo、教练头像 Profile_*、List/Timer 图标…）
└─ src/
   ├─ main.jsx                      React 入口，挂载 App
   ├─ App.jsx                       路由表（哪个 URL → 哪个页面）
   ├─ api/
   │  ├─ client.js                  axios 实例：baseURL + 自动带 token + 401 处理
   │  └─ auth.js                    登录 / 注册的 API 调用
   ├─ auth/
   │  └─ storage.js                 token/user 存哪里（Remember me：local vs session）（LZH 新增）
   ├─ context/
   │  └─ AuthContext.jsx            全局登录状态（token、user、login/logout）
   ├─ components/
   │  ├─ AppLayout.jsx              登录后的整体布局（侧边栏 + 内容区）
   │  ├─ ProtectedRoute.jsx         路由守卫（没登录踢回登录页；admin 角色检查）
   │  ├─ PasswordInput.jsx          带「显示/隐藏」眼睛的密码框
   │  └─ BlinkFace.jsx              教练头像眨眼动画（LZH 新增）
   ├─ pages/
   │  ├─ LandingPage.jsx            落地页（未登录首页）
   │  ├─ LoginPage.jsx              登录
   │  ├─ SignupPage.jsx             注册
   │  ├─ Dashboard.jsx              仪表盘（统计图表 + 教练唠叨）
   │  ├─ Tasks.jsx                  任务 + 甘特图（拖拽排程）
   │  ├─ Pomodoro.jsx               番茄钟（← 同学 A）
   │  ├─ Coach.jsx                  AI 教练聊天（← 同学 B）
   │  ├─ Ranking.jsx                排行榜
   │  ├─ AdminDashboard.jsx         后台管理（← 同学 C）
   │  └─ Settings.jsx               我的资料 / 改密码
   ├─ data/
   │  └─ mock.js                    假数据 + 教练 personas（真假数据混在这，注意）
   ├─ utils/
   │  └─ taskColor.js               任务颜色（Tasks 和 Pomodoro 共用）
   └─ styles/
      └─ prototype.css              主样式表
```

---

## 🔑 账号（演示 / 种子）

> 仅用于开发 / 演示。JWT 密钥和管理员密码已放进 user-secrets，不再提交。

### 管理员

| 字段 | 值 |
|---|---|
| 邮箱 | `swe310admin@nagstudy.app` |
| 密码 | `SWE310Admin@Team1` |
| 昵称 | `Admin` |
| 角色 | `Admin` |

- 邮箱/昵称来自 `appsettings.json`，**密码来自 user-secrets**（`Admin:Password`）。
  邮箱写库时转小写，所以**用上面的小写邮箱登录**。
- ⚠️ 注意：后台以前显示 `admin@nagstudy.app`（错的，不能登录），LZH 已改成真实的
  `swe310admin@nagstudy.app`。

### 演示学生（密码都一样 `Demo@1234`，角色 `User`）

| 昵称 | 邮箱 |
|---|---|
| FocusFox | `focusfox@xmu.edu.my` |
| StudyStar | `studystar@xmu.edu.my` |
| Snoozebun | `snoozebun@xmu.edu.my` |
| LazyLamb | `lazylamb@xmu.edu.my` |
| NightOwl | `nightowl@xmu.edu.my` |

- **FocusFox** 累计专注最多，适合展示数据丰富的仪表盘 / 排行榜靠前。
- **Snoozebun** 是落地页里当作「你」的示例角色。

### 注册规则

- 邮箱必须以 `@xmu.edu.my` 结尾。
- 密码：至少 8 位，含至少一个大写字母、一个数字、一个特殊符号。
- 密码以 BCrypt 哈希存储，数据库里只看得到 `$2a$...` 哈希（正常）。

---

## 📊 已完成 —— `LZH- 解决了6.16`

> 以下全部由 LZH 在 6.16 完成并通过编译/运行验证。**不用再做。**

### 1. 后端稳定性 — `LZH- 解决了6.16`

- **claim 解析安全化**：新增公共扩展 `ClaimsPrincipalExtensions.GetUserId()`（`TryParse`，
  失败抛 `UnauthorizedAccessException`），6 个控制器统一。畸形 token 现在返回干净的 **401**。
- **全局异常处理**：新增 `GlobalExceptionHandler`，401/500 映射，返回 `ProblemDetails`
  （不泄露堆栈），只有 500 才写服务器日志。
- **register 并发**：`SaveChangesAsync` 包 try/catch，撞唯一索引时返回 **400** 而不是 500。

### 2. DTO 校验 + 日期解析 — `LZH- 解决了6.16`

- `When` 只允许 `Now/Later`，`Status` 只允许 `Inbox/Scheduled/Done`（正则）。
- `Color` 只允许十六进制（`TaskRequest` + `CategoryRequest`）。
- `StudySessionRequest.StartedAt` 拒绝未来时间（5 分钟容差）→ 防止刷排行榜/仪表盘。
- `GET /api/tasks?date=` 改用 `TryParseExact("yyyy-MM-dd", InvariantCulture)`。

### 3. 前端错误处理（`Tasks.jsx`）— `LZH- 解决了6.16`

- 所有 mutation（改状态/颜色/标题/时间、删除、拖拽保存、初始加载）失败时**回滚** + 红色 ⚠️ toast。
- `addTask` 失败时**恢复输入框文字**；拖拽/缩放保存失败时方块**弹回原位**。空 catch 全部移除。

### 4. "Remember me" 真正生效 — `LZH- 解决了6.16`

- 新增 `auth/storage.js`：勾选 = `localStorage`，不勾 = `sessionStorage`。
- `AuthContext` / `api/client.js` / `LoginPage` 都经过它，axios 拦截器两个存储都读。

### 5. 落地页打磨 — `LZH- 解决了6.16`

- GitHub 链接改成 `https://github.com/asgxmum/NagStudy`；`Home` 导航 `#screen-home`；
  表单 label 用 `htmlFor`/`id` 关联（Login 2 · Signup 4 · Settings 5）。

### 6. JWT 安全 — `LZH- 解决了6.16`

- `Jwt:Key` + `Admin:Password` 移入 user-secrets；`appsettings.json` 已删这两个值；
  有效期 30 天 → **120 分钟**；`Program.cs` 缺密钥时清晰报错；新增 `.gitignore` 和本 README。

### 7. 杂项 — `LZH- 解决了6.16`

- `AdminDashboard.jsx` 右上角管理员邮箱修正为真实的 `swe310admin@nagstudy.app`。

---

## 🚧 剩余任务

严重程度：🔴 Bug · 🟡 风险 · 🟢 优化。

> **番茄钟时钟是纯前端问题**，后端用 `DateTime.UtcNow` 正确以 UTC 存储/返回。**别为它改后端。**

---

### 👤 同学 A — 番茄钟时钟（🔴）

#### 📂 要读哪些文件（以及为什么）

- **`NagStudy.Web/src/pages/Pomodoro.jsx`** —— 主战场，两个时钟 bug 都在这里
  （demo 计时 interval、`asLocal`、`mm:ss` 显示）。
- **`NagStudy.Web/src/pages/Tasks.jsx`（第 20–24 行 `minOfDay`）** —— 这里有**正确的** `Z` 正则
  保护写法，A2 直接照抄。
- **`NagStudy.Web/src/pages/Dashboard.jsx`（第 98 行 `asUtc`）** —— 同样的正则保护参考，确认
  三个文件写法一致。
- **`NagStudy.Web/src/utils/taskColor.js`** —— Pomodoro 用它给任务上色；了解颜色来源，别误改。
- **`NagStudy.Web/src/styles/prototype.css`（`.ring-center .time` 等）** —— 只有要改时钟**显示样式**
  时才看。

#### 任务详情

**A1. 🔴 演示（demo）模式下秒数看起来卡住不动**

- 位置：第 ~118 行（interval）和第 ~229 行（`ss = pad(left % 60)`）。
- 原因：demo 模式每过 1 真实秒就把 `left` 减 60，时钟 `25:00 → 24:00 → 23:00` 一分钟一跳，
  秒数永远不动 —— 看起来像坏了。
- 修改思路：`demo` 打开时隐藏 `:ss` 并显示 `×60 demo`，或渲染一个假的会走动的秒数。
  非 demo 模式现在正常，不用动。

**A2. 🔴 `asLocal()` 无条件加 `Z` → 可能产生 `Invalid Date`**

- 位置：第 31 行 —— `const asLocal = (iso) => new Date(`${iso}Z`);`
- 修改：和其它文件保持一致：

  ```js
  const asLocal = (iso) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  ```

---

### 👤 同学 B — Coach AI 使用真实数据（🔴）

#### 📂 要读哪些文件（以及为什么）

- **`NagStudy.Web/src/pages/Coach.jsx`** —— 主战场，要把 mock 的 `todayMin` 换成真实数据。
- **`NagStudy.Web/src/data/mock.js`（第 78 行 `todayMin`）** —— 假数据 155 的来源；改完要删掉这个导入。
- **`NagStudy.Web/src/pages/Dashboard.jsx`（第 90–119 行）** —— 抄它怎么 `GET /dashboard`、
  怎么把 `todaySeconds` 换算成分钟、怎么算「错过的任务数」。
- **`NagStudy.API/Controllers/DashboardController.cs`** —— 确认 `/dashboard` 返回的字段名
  （`todaySeconds` 等），保证前端读对字段。
- **`NagStudy.Web/src/api/client.js`** —— 了解 `api` 实例（baseURL、拦截器、`api.get` 用法）。

#### 任务详情

**B1. 🔴 Coach 用的是假的专注分钟数**

- 位置：从 mock.js 导入 `todayMin`（第 3 行），织进 `coachReply`（~30 行）和 `nagText`（~65 行）。
  硬编码 155，所以教练永远说「你今天专注了 2h 35m」。
- 修改：挂载时获取真实值：

  ```js
  const [todayMin, setTodayMin] = useState(0);
  useEffect(() => {
    api.get("/dashboard")
      .then((res) => setTodayMin(Math.round(res.data.todaySeconds / 60)))
      .catch(() => {});
  }, []);
  ```

  然后把 `todayMin` 作为参数传进 `coachReply` / `nagText`，删掉 mock.js 的导入。
- 完成标准：教练说的话和 Dashboard 上的数字一致。

---

### 👤 同学 C — 后台 Admin（🔴，后端 + 前端）

#### 📂 要读哪些文件（以及为什么）

**后端：**

- **`NagStudy.API/Controllers/TasksController.cs`（开头）** —— 抄控制器标准写法：`[Authorize]`、
  注入 `_db`、`CurrentUserId => User.GetUserId()`、返回类型。你的 `AdminController` 照这个骨架写。
- **`NagStudy.API/Program.cs`（认证段 + 管理员种子段）** —— 看授权怎么配的（`[Authorize(Roles="Admin")]`
  能用是因为 token 里有 Role），以及种子管理员怎么建的。
- **`NagStudy.API/Services/TokenService.cs`（第 27–33 行）** —— 确认 token 里写了
  `ClaimTypes.Role`，所以 `Roles="Admin"` 才生效。
- **`NagStudy.API/Models/Domain/User.cs`** —— User 字段（`Status`/`Role`/`Email`/`Nickname`），
  你的接口要返回/修改这些。
- **`NagStudy.API/Data/NagStudyContext.cs`** —— 看 `DbSet`（`Users` 等），写查询用。

**前端：**

- **`NagStudy.Web/src/pages/AdminDashboard.jsx`** —— 主战场，把 mock 换成真实 API。
- **`NagStudy.Web/src/pages/Tasks.jsx`（LZH 刚做的乐观更新 + 回滚 + toast）** —— 封禁/删除照这个模式做，
  失败要回滚 + 提示。
- **`NagStudy.Web/src/components/ProtectedRoute.jsx`** —— 看 admin 路由是怎么按 role 保护的。
- **`NagStudy.Web/src/data/mock.js`（`adminUsers`）** —— 看要替换掉的假数据结构。
- **`NagStudy.Web/src/api/client.js`** —— `api` 实例用法。

#### 任务详情

**C1. 🔴 后端没有 `AdminController`** (已解决, 6.23-ZZY)

- `User.Status`（`Active/Banned/Deleted`）、种子管理员、`Role == "Admin"` 都存在并被用到，
  却没地方能改它们。
- 新增带 `[Authorize(Roles = "Admin")]` 的 `AdminController`：
  - `GET  /api/admin/users` —— 列出用户（id、昵称、邮箱、角色、状态）。
  - `PUT  /api/admin/users/{id}/status` —— 设为 `Active` / `Banned` / `Deleted`。
  - （可选）`PUT /api/admin/users/{id}/role`。
- 完成标准：管理员 token 能列出用户并改状态；普通用户得到 403。

**C2. 🔴 `AdminDashboard.jsx` 全是假数据**

- 统计卡片和用户表来自 `seedUsers`；封禁/删除只改本地 state，没调 API。
- 改成从 `GET /api/admin/users` 获取；封禁/删除接到 `PUT .../status`，乐观更新 + 失败提示。
- 字段对齐：mock 用 `nick`，后端返回 `nickname` —— 表格里要从 `u.nick` 改成 `u.nickname`。
- 注意：右上角管理员邮箱 LZH 已改对，重写时别又写回错的。

**状态行为规范（Admin 用户管理）—— 重要，照这个做**

- 状态只有三种：`Active` / `Banned` / `Deleted`。
- **Ban / Unban 按钮**：只在 `Active` ↔ `Banned` 之间切换，**绝不碰 `Deleted`**。
- **Delete 按钮**：调 `PUT /api/admin/users/{id}/status` body `{ "status": "Deleted" }`（软删除，DB 保留记录），成功后**该行从列表消失**。
- **列表默认不显示 `Deleted` 用户**：前端 `users.filter(u => u.status !== "Deleted")`，或请后端在 `GET /admin/users` 加 `.Where(u => u.Status != "Deleted")`（任选其一，前端做就够）。
- ❌ **禁止**：`Deleted` 用户被 Ban/Unban 重新变回 `Active`（这是 bug，不是预期行为）。

> C1 和 C2 是一对 —— 先做后端接口，再接前端。

---

## ✅ 已经正确（已核实 —— 不要动）

- 没有 IDOR：tasks / categories / sessions 都按当前用户过滤。
- 注册、登录、改密码都用 BCrypt；`PasswordHash` 从不被序列化返回。
- 每个资源控制器都有 `[Authorize]`；`AuthController` 正确允许匿名。
- 时间统一以 UTC 存储/返回（`DateTime.UtcNow`）。
- `StudySession.TaskId` 是可空外键，`OnDelete(SetNull)`。
