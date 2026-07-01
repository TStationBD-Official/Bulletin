# Dark Mode Implementation Guide

## Overview
Multi-theme support has been added with Light, Dark, and Auto (system preference) modes.

## How It Works
1. **Theme Store** (`src/store/useTheme.ts`) - Zustand store with persistence
2. **Theme Toggle** (`src/components/ThemeToggle.tsx`) - Button in header to switch themes
3. **Tailwind Dark Mode** - Uses `dark:` class prefix with `darkMode: "class"`
4. **localStorage** - Theme preference persists across sessions

## Using Dark Mode in Components

### Basic Dark Mode Classes
```tsx
// Background
className="bg-white dark:bg-dark-card"
className="bg-gray-50 dark:bg-dark-bg"

// Text
className="text-gray-900 dark:text-dark-primary"
className="text-gray-500 dark:text-dark-secondary"
className="text-gray-400 dark:text-dark-tertiary"

// Borders
className="border-gray-200 dark:border-dark-border"

// Hover
className="hover:bg-gray-100 dark:hover:bg-dark-border"
```

### Color Scheme Reference
**Light Mode:**
- Background: `#ffffff` (white)
- Card: `#ffffff` (white)
- Border: `#e5e7eb` (gray-200)
- Text Primary: `#111827` (gray-900)
- Text Secondary: `#6b7280` (gray-500)
- Text Tertiary: `#9ca3af` (gray-400)

**Dark Mode:**
- Background: `#0f172a` (dark-bg / slate-900)
- Card: `#1e293b` (dark-card / slate-800)
- Border: `#334155` (dark-border / slate-700)
- Text Primary: `#f1f5f9` (dark-primary / slate-100)
- Text Secondary: `#cbd5e1` (dark-secondary / slate-300)
- Text Tertiary: `#94a3b8` (dark-tertiary / slate-400)

## Component Updates Pattern

For any component that needs dark mode, use this pattern:

```tsx
// Backgrounds
<div className="bg-white dark:bg-dark-card rounded-lg">
  {/* Text */}
  <h2 className="text-gray-900 dark:text-dark-primary">Title</h2>
  <p className="text-gray-600 dark:text-dark-secondary">Subtitle</p>
  
  {/* Borders */}
  <div className="border border-gray-200 dark:border-dark-border" />
  
  {/* Inputs */}
  <input className="border border-gray-200 dark:border-dark-border dark:bg-dark-card dark:text-dark-primary" />
</div>
```

## Files That Have Dark Mode Support

Already Updated:
- ✅ `src/app/layout.tsx` - Root layout with theme initializer
- ✅ `src/app/globals.css` - Global dark mode styles
- ✅ `src/app/page.tsx` - Feed page background
- ✅ `src/components/Header.tsx` - Header styling
- ✅ `src/components/PostCard.tsx` - Post card styling
- ✅ `src/components/ThemeToggle.tsx` - Theme switcher
- ✅ `tailwind.config.ts` - Tailwind dark mode config

## How to Update Other Components

1. Add dark mode classes to main container:
   ```tsx
   className="bg-white dark:bg-dark-card"
   ```

2. Update text colors:
   ```tsx
   className="text-gray-900 dark:text-dark-primary"
   ```

3. Update borders:
   ```tsx
   className="border-gray-200 dark:border-dark-border"
   ```

4. Update hover/active states:
   ```tsx
   className="hover:bg-gray-100 dark:hover:bg-dark-border"
   ```

## Tailwind Classes Available

All standard Tailwind dark mode classes work:
- `dark:text-*` - Text colors
- `dark:bg-*` - Background colors
- `dark:border-*` - Border colors
- `dark:hover:*` - Hover states in dark mode
- `dark:focus:*` - Focus states in dark mode

Plus custom dark mode colors defined in `tailwind.config.ts`:
- `dark:bg-dark-bg` - Main background (#0f172a)
- `dark:bg-dark-card` - Card background (#1e293b)
- `dark:border-dark-border` - Borders (#334155)
- `dark:text-dark-primary` - Primary text (#f1f5f9)
- `dark:text-dark-secondary` - Secondary text (#cbd5e1)
- `dark:text-dark-tertiary` - Tertiary text (#94a3b8)

## Testing Dark Mode

1. Click the theme toggle (sun/moon icon) in the top right
2. Select "Dark" to enable dark mode
3. Select "Light" to enable light mode
4. Select "Auto" to follow system preference
5. Refresh the page - your selection persists

## System Preference Detection

When set to "Auto" mode:
- Uses `prefers-color-scheme: dark` media query
- Automatically switches if user changes system theme
- Listens for system theme changes in real-time

## Browser Support

Dark mode works in all modern browsers that support:
- CSS custom properties
- `prefers-color-scheme` media query
- `classList` DOM API
- `localStorage`
