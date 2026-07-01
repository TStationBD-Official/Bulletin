# Category System — Integration Reference

## Overview

Posts in Bulletin can belong to one category. Categories are stored in Firestore and managed by the SuperAdmin. Users select a category when creating a post. The feed page lets visitors filter posts by category.

---

## Data Model

### `categories/{slug}` collection

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Same as document ID (e.g. `"mathematics"`) |
| `name` | string | Display name (e.g. `"Mathematics"`) |
| `slug` | string | Same as `id` — URL-safe kebab-case |
| `description` | string | Short description shown in admin |
| `color` | string | Hex color for badge (e.g. `"#f59e0b"`) |
| `icon` | string | Emoji icon (e.g. `"🔢"`) |
| `postCount` | number | Approximate count of posts in this category |
| `isDefault` | boolean | `true` only for `"general"` — cannot be deleted |
| `isActive` | boolean | Inactive categories hidden from UI |
| `order` | number | Display order (ascending) |
| `createdAt` | Timestamp | Creation time |
| `updatedAt` | Timestamp | Last modified time |
| `createdBy` | string | UID of creator |

### Post document — category fields

Four new **optional** fields were added to `posts/{postId}`. Old posts without these fields automatically fall back to "General" in the UI:

| Field | Type | Default (fallback) |
|-------|------|-------------------|
| `categoryId` | string | `"general"` |
| `categoryName` | string | `"General"` |
| `categoryColor` | string | `"#6366f1"` |
| `categoryIcon` | string | `"📌"` |

All four are stored directly on the post document to avoid extra reads at card render time.

---

## Default Seed Categories

These 10 categories are seeded into Firestore on first admin visit (`seedDefaultCategories` is idempotent — safe to call multiple times):

| ID | Name | Icon | Color |
|----|------|------|-------|
| `general` | General | 📌 | `#6366f1` |
| `mathematics` | Mathematics | 🔢 | `#f59e0b` |
| `science` | Science | 🔬 | `#10b981` |
| `english` | English | 📖 | `#3b82f6` |
| `history` | History & Geography | 🌍 | `#8b5cf6` |
| `technology` | Technology | 💻 | `#06b6d4` |
| `arts` | Arts & Creativity | 🎨 | `#ec4899` |
| `study-tips` | Study Tips | 💡 | `#f97316` |
| `announcements` | Announcements | 📢 | `#ef4444` |
| `qna` | Q&A | 💬 | `#14b8a6` |

---

## Component Flow

```
User visits /compose
  └── getCategories() fetches active categories from Firestore
  └── Category pill grid renders (single-select, "General" pre-selected)
  └── On submit → createPost() stores categoryId/Name/Color/Icon on post doc
                → categories/{id}.postCount increments

User visits / (feed)
  └── getCategories() fetches active categories
  └── Horizontal tab strip renders: "All" + one pill per category
  └── Clicking a tab filters posts client-side: post.categoryId === selectedId
  └── Old posts (no categoryId) match "All" and show "General" badge

User visits /post/{id}
  └── post.categoryName ?? "General" renders as badge on post detail
  └── No extra Firestore reads needed (stored on post doc)

SuperAdmin visits /admin/categories
  └── seedDefaultCategories() runs (idempotent)
  └── onSnapshot on `categories` provides real-time list
  └── Can: Add new / Edit any / Toggle active / Delete (non-default only)
  └── Delete → posts reassigned to "general" in batches of 490

SuperAdmin visits /admin/pending
  └── getCategories() loads category list
  └── Each pending post card shows category picker (pre-filled)
  └── Approve → approvePost(postId, uid, categoryOverride) merges chosen category onto post
```

---

## Backward Compatibility

- **Old posts** (no `categoryId` field): render `"General"` badge everywhere via `?? "General"` fallback.
- **Feed filter**: "All" tab is the default — existing behavior unchanged for all users.
- **No new Firestore composite indexes required**: category filtering is done client-side on the already-loaded feed.
- **No data migration needed**: old posts remain valid, new fields are optional.

---

## Firestore Security Rules

Add this rule block to `firestore.rules`:

```
match /categories/{categoryId} {
  // Anyone can read categories (needed for feed filter)
  allow read: if true;

  // Only superAdmins can write
  allow write: if request.auth != null
    && exists(/databases/$(database)/documents/super_admins/$(request.auth.uid));
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/categories.ts` | All category Firestore helpers + seed data |
| `src/types/index.ts` | `Category` interface + Post category fields |
| `src/app/admin/categories/page.tsx` | SuperAdmin CRUD management page |
| `src/app/compose/page.tsx` | Category pill selector in create post flow |
| `src/components/PostCard.tsx` | Category badge on each post card |
| `src/app/page.tsx` | Category filter tab strip on feed |
| `src/app/admin/pending/page.tsx` | Category override selector on approval |
| `src/components/admin/AdminSidebar.tsx` | "Categories" nav item added |

---

## How to Add a New Category

**Via Admin UI (recommended):**
1. Sign in as SuperAdmin → Admin Panel → Categories
2. Click "New Category"
3. Fill in name, description, pick emoji and color, set display order
4. Click "Create Category"

**Via `SEED_CATEGORIES` constant (for developers):**
1. Open `src/lib/categories.ts`
2. Add a new entry to the `SEED_CATEGORIES` array
3. The next time the admin page loads, it will be seeded automatically

---

## postCount Accuracy

`categories/{id}.postCount` is incremented by `+1` when a post is created via `createPost()`. It is **not** decremented on deletion (tracking deletions across all post states would require a listener). Use the admin dashboard for accurate per-category counts when needed.
