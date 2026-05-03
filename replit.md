# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack project management app with React/Vite frontend, Express API backend, Clerk auth, and PostgreSQL database.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (`@clerk/react` v6 on frontend, `@clerk/express` on backend)
- **Frontend state**: Redux Toolkit + React Router v7
- **Frontend styling**: Tailwind CSS v4

## Artifacts

### `artifacts/project-management` — React/Vite frontend (path: `/`)
- Entry: `src/main.tsx` → `src/App.jsx`
- State: `src/features/workspaceSlice.js` — all async thunks for workspaces/projects/tasks/comments
- API client: `src/lib/api.js` — fetch wrapper with Clerk token injection (`setTokenGetter`)
- Auth wiring: `AuthBridge` component in `App.jsx` calls `setTokenGetter(getToken)` from `useAuth()` and dispatches `fetchWorkspaces()` on sign-in
- Redux auth guards: `RequireAuth` / `RedirectIfSignedIn` components in `App.jsx`
- All DB fields use camelCase matching Drizzle ORM output: `dueDate`, `startDate`, `endDate`, `imageUrl`, `teamLead`, `workspaceId`, `projectId`, `assigneeId`

### `artifacts/api-server` — Express backend (path: `/api`)
- Entry: `src/index.ts` → `src/app.ts`
- Routes: `webhook`, `users`, `workspaces`, `projects`, `tasks`, `comments`
- Auth middleware: `src/middleware/auth.ts` — verifies Clerk JWT, provides `authenticate` + `requireWorkspaceMember`
- Webhook: `POST /api/webhooks/clerk` — syncs Clerk user/org/membership events to DB (svix verification)
- Raw body middleware on `/api/webhooks/clerk` before global `express.json()`

### `artifacts/mockup-sandbox` — Canvas/design preview server (path: `/canvas`)

## Database Schema (lib/db)

Tables: `users`, `workspaces`, `workspaceMembers`, `projects`, `projectMembers`, `tasks`, `comments`, `notifications`, `labels`, `taskLabels`, `taskAssignees`

- Workspace IDs = Clerk org IDs (text PK)
- User IDs = Clerk user IDs (text PK)
- Project/task/comment IDs = `randomUUID()`
- Enum types: task `status` (TODO/IN_PROGRESS/DONE), `type` (TASK/BUG/FEATURE/IMPROVEMENT/OTHER), `priority` (LOW/MEDIUM/HIGH)
- `tasks` table has `estimatedMinutes` (nullable int) and `loggedMinutes` (int, default 0) for time tracking
- `notifications` table: userId, type (TASK_ASSIGNED/COMMENT_ON_TASK/TASK_DONE/MENTION), title, body, taskId, read (bool)
- `labels` table: per-project color labels; `taskLabels` is the many-to-many join
- `taskAssignees` table: additional assignees beyond the primary `assigneeId` (max 5 total)

## Features

1. **Global Search** — `/api/search` endpoint, debounced search in Navbar with grouped dropdown (Tasks/Projects/People)
2. **In-App Notifications** — Bell icon in Navbar with unread badge; `/api/notifications` routes; triggers on task assign, status→DONE, comments, and @mentions; polls every 30s
3. **Labels/Tags** — Per-project colored labels; task-label many-to-many; `/api/projects/:id/labels` + `/api/tasks/:id/labels` routes; managed inline in TaskDetails
4. **@Mentions in Comments** — `@name` autocomplete dropdown in comment textarea; mention parsing fires MENTION notifications to named users
5. **Timeline Tab** — Per-project Gantt chart (`ProjectTimeline.jsx`) in ProjectDetails
6. **Workload View** — Team page workload section with per-member task bar chart by priority
7. **Time Tracking** — Estimate + log time in TaskDetails with progress bar; PATCH `/api/tasks/:id` accepts `estimatedMinutes`/`loggedMinutes`
8. **Multiple Assignees** — Up to 5 assignees; extra assignees panel in TaskDetails with add/remove; `/api/tasks/:id/assignees` routes

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Secrets

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (frontend)
- `CLERK_SECRET_KEY` — Clerk secret key (backend)
- `CLERK_WEBHOOK_SECRET` — Clerk webhook signing secret (svix)
- `SESSION_SECRET` — session secret
- `DATABASE_URL` — PostgreSQL connection string

## Clerk Webhook URL

`https://<replit-domain>/api/webhooks/clerk` — configured in Clerk dashboard to receive `user.*`, `organization.*`, `organizationMembership.*` events.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
