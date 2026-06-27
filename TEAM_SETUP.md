# temp 分支 — 队友启动指南

合并 `temp` 到本地后，按顺序做一次即可跑通 AI / Coach / Trigger 功能。

## 1. 拉分支

```powershell
git fetch origin
git checkout temp
```

## 2. user-secrets（每人本地配置，**不会进 Git**）

在 `NagStudy.API/` 目录：

```powershell
# 必填 — 后端 JWT
dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String((1..48 | % { Get-Random -Maximum 256 })))"

# 必填 — 种子管理员（团队统一）
dotnet user-secrets set "Admin:Password" "SWE310Admin@Team1"

# 必填 — RAG Embedding + 可选 Chat（Gemini）
dotnet user-secrets set "Gemini:ApiKey" "YOUR_GEMINI_KEY"

# 可选 — 聊天 Provider（默认 appsettings 里 Llm:Provider=Gemini）
# 若用 MiniMax：
dotnet user-secrets set "Llm:Provider" "MiniMax"
dotnet user-secrets set "MiniMax:ApiKey" "sk-cp-..."
# 中国区 Token Plan 需匹配 BaseUrl：
dotnet user-secrets set "MiniMax:BaseUrl" "https://api.minimaxi.com/v1"
```

查看已配置：`dotnet user-secrets list`

## 3. 数据库连接字符串

编辑 `NagStudy.API/appsettings.json`，把 `YOUR_SQL_SERVER` 改成自己机器的 SQL Server 实例名（**改完不要 commit**）。

## 4. 运行

```powershell
# 终端 1 — API
cd NagStudy.API
dotnet run

# 终端 2 — 前端
cd NagStudy.Web
npm install
npm run dev
```

- API：`https://localhost:5178/api`
- 前端：`http://localhost:5173`

## 5. 演示账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 演示学生 | `focusfox@xmu.edu.my` | `Demo@1234` |
| 管理员 | `SWE310admin@nagstudy.app` | user-secrets 里的 `Admin:Password` |

## 6. 数据库说明

- 不用 `dotnet ef`，首次 `dotnet run` 自动建表。
- 从旧库升级若缺 `UserActivities` 表：重启 API 会自动补建；或删库 `NagStudyDb` 重建。

## 7. 未纳入 Git 的文件

- `Description_Group_Project.pdf` — 已 gitignore
- API Key / JWT / Admin 密码 — 仅在 user-secrets
- `NagStudy.slnx` — VS 解决方案文件，可保留，无敏感信息
