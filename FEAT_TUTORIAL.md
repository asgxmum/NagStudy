# feat/tutorial — 队友合并指南

本分支在 `LZH-temp-fixes-6.28` 基础上新增了以下功能，合并前请按步骤操作。

## 新增功能

- **新手引导 Tour**：新用户登录后自动触发，逐页介绍 Dashboard、Tasks、Pomodoro、Coach、Ranking、Settings 的主要功能
- **Remember Me**：登录页勾选后下次自动填入邮箱
- **Tour 完成状态持久化**：后端 `Users` 表新增 `HasSeenTutorial` 字段，完成或跳过 tour 后写入数据库，不依赖 localStorage

## 数据库变更（⚠️ 必须手动操作）

本分支新增了 `HasSeenTutorial` 字段，直接用 SQL 加，不用 EF 迁移。

在 SQL Server Management Studio 里对 `NagStudyDb` 执行：

```sql
ALTER TABLE Users ADD HasSeenTutorial BIT NOT NULL DEFAULT 0;
```

## 合并步骤

```powershell
git fetch origin
git checkout LZH-temp-fixes-6.28
git pull origin LZH-temp-fixes-6.28
git merge feat/tutorial
```

## 新增依赖

前端新增了 `intro.js`，合并后运行：

```powershell
cd NagStudy.Web
npm install
```

这会自动安装 `intro.js` 及其他依赖。

## 后端接口变更

新增一个接口：

| 方法 | 路由 | 说明 |
|------|------|------|
| `PUT` | `/api/users/me/tutorial` | 标记用户已完成 tour |

`GET /api/users/me` 返回新增字段 `hasSeenTutorial: bool`。

## 文件变更清单

**前端（`NagStudy.Web/src/`）**

- `pages/Dashboard.jsx` — tour 引导
- `pages/Tasks.jsx` — tour 引导
- `pages/Pomodoro.jsx` — tour 引导
- `pages/Coach.jsx` — tour 引导
- `pages/Ranking.jsx` — tour 引导
- `pages/Settings.jsx` — tour 引导 + 修复 element 选择器
- `pages/LoginPage.jsx` — Remember Me 功能
- `components/AppLayout.jsx` — TourProvider 集成
- `context/TourContext.jsx` — tour 全局状态
- `context/useTour.js` — tour hook
- `context/tourPages.js` — tour 页面顺序
- `styles/tour.css` — tour UI 样式

**后端（`NagStudy.API/`）**

- `Models/Domain/User.cs` — 新增 `HasSeenTutorial` 字段
- `Controllers/UsersController.cs` — 新增 `PUT /api/users/me/tutorial` 接口 + `MapUser` 返回新字段
