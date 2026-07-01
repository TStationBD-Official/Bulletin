# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Next.js on port 3000)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint via next lint
npm run type-check   # TypeScript check without emitting (tsc --noEmit)
```

There are no tests in this project.

## Architecture

**Next.js 14 App Router** + TypeScript + Tailwind CSS + Firebase + Zustand.

This is a social blogging/feeds website ("Bulletin") that shares the same Firebase project (`tuition-core-f00c7`) as a companion Flutter tutoring app.

### Key directories

- `src/app/` — Next.js App Router pages. Route segments: `/`, `/post/[id]`, `/compose`, `/author/[authorId]`, `/saved`, `/profile`, `/admin/**`, `/terms`, `/privacy`, `/guidelines`, `/approve`
- `src/components/` — Shared React components. `src/components/admin/` holds admin-only UI pieces.
- `src/lib/` — Service layer: `firebase.ts` (init), `firestore.ts` (all Firestore CRUD), `auth.ts` (sign-in / role resolution), `drive.ts` + `driveAuth.ts` (Google Drive image upload), `utils.ts`, `categories.ts`
- `src/hooks/` — `useAuth.ts` (Firebase auth listener, bootstraps global store), `useNotifications.ts`, `useAdminStats.ts`, `useSettings.ts`
- `src/store/useStore.ts` — Single Zustand store: auth state (user, userRole, userData, accessToken), notifications, pendingPostsCount, site settings
- `src/types/index.ts` — All shared TypeScript types

### Authentication & role resolution

`useAuth` (mounted in `src/app/providers.tsx`) listens to `onAuthStateChanged` and calls `resolveUserRole` which checks Firestore collections in priority order: `super_admins` → `admins` → `students` → `guardians` → `feeds_user_only`. If none match, a new `feeds_user_only` doc is created. The resolved role + user data live in Zustand.

Google OAuth also requests `drive.file` scope. The access token is stored in Zustand (`accessToken`) and silently refreshed every 50 min via `driveAuth.ts`.

### Firestore data model

All data is in Cloud Firestore. Key collections:
- `posts` — main posts (status: pending/approved/rejected/deleted; visibility: public/internal). Subcollections: `likes/{userId}`, `comments/{commentId}`, `comments/{commentId}/replies/{replyId}`, `viewers/{userId}`, `shares/{shareId}`
- `feeds_user_only` — website-only users
- `super_admins`, `admins`, `students`, `guardians` — Flutter app users (shared)
- `users_metadata` — lightweight role index for all users
- `notifications` — per-user notifications
- `reports` — content reports submitted by users
- `admin_logs` — audit trail of all superAdmin actions
- `app_settings/feeds_website` — site-wide config (moderation rules, branding, rate limits)
- `categories` — post categories managed via `/admin/categories`

All Firestore operations go through `src/lib/firestore.ts`. The feed uses `onSnapshot` real-time listeners (not one-time fetches). Author profile photos are resolved by checking all role collections in order; results are cached in a module-level `Map` (`authorCache`).

### Internal posts

Internal posts (`visibility: "internal"`) are scoped to an admin's circle via `adminGroupId` field (the admin's UID). Only that admin and their assigned students/guardians can see them. SuperAdmins see all internal posts.

### Composite Firestore indexes

The app avoids multi-field composite indexes where possible (to skip Firebase Console setup). Trending posts fetch 100 recent approved posts and sort by engagement client-side. Internal post queries filter `adminGroupId` server-side and `status`/`visibility` client-side. The composite indexes that *are* needed are listed in `firestore.indexes.json`.

### Environment variables

Requires a `.env.local` file with `NEXT_PUBLIC_FIREBASE_*` vars and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. See `feeds_website_blueprint.md` for the full list.

### Rich text

Posts are stored as Quill Delta JSON in `richContent`. The editor is `src/components/RichTextEditor.tsx` (react-quill). Rendering uses `quill-delta-to-html`.

### Theming

Dark mode is supported via Tailwind's `dark:` classes. Theme preference is persisted in `localStorage` via a Zustand store (`src/store/useTheme.ts`). A blocking inline script in the root layout (`src/app/layout.tsx`) prevents flash of wrong theme on load.

### Admin dashboard

`/admin/**` routes are guarded by role check in `src/app/admin/layout.tsx`. Only `superAdmin` users can access. The sidebar (`AdminSidebar`) links to: overview, pending posts, all posts, users, reported content, categories, settings, and audit logs.
