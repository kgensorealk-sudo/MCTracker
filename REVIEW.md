# Code Review: MasterCopy Analyst Tracker

## 1. Executive Summary
The application is a well-structured React application for tracking manuscripts, designed with offline capabilities and gamification elements. It uses **Vite** for build tooling, **Supabase** for backend services, and **Tailwind CSS** for styling.

While the core functionality seems robust, there are **critical security risks** related to hardcoded credentials and several areas where code maintainability could be improved by refactoring large components.

## 2. Critical Issues (Security & Stability)

### 🚨 Hardcoded Supabase Credentials
**File:** `lib/supabase.ts`
The most critical issue is the presence of hardcoded Supabase API keys and URL in the source code:
```typescript
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://xuowcacfxqikysuxuojs.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOi...';
```
**Risk:** While "Anon" keys are technically public-safe if Row Level Security (RLS) is perfect, hardcoding them encourages bad practices. If a service role key were ever accidentally pasted here, it would give full database access to anyone who views the code.
**Recommendation:** Remove the fallback strings. Rely strictly on `.env` files. If you need a demo mode, use a mock service instead of real credentials.

### ⚠️ "God Component" Architecture
**File:** `App.tsx`
`App.tsx` is handling too many responsibilities:
- Authentication state
- Data fetching (`loadData`)
- Business logic (`autoEscalate`)
- Routing/View switching
- Offline mode management

This makes the application hard to test and maintain.

## 3. Code Quality & Maintainability

### Large Components
**File:** `components/ManuscriptList.tsx` (~800 lines)
This component is doing too much:
- Displaying the list
- Handling filtering & sorting logic
- Managing multiple modals (Query, Delete, Bulk)
- Rendering complex UI elements

**Recommendation:** Break this down into smaller components:
- `ManuscriptFilters.tsx`
- `ManuscriptTable.tsx`
- `ManuscriptRow.tsx`
- `ActionModals/`

### Business Logic Leaking into UI
**File:** `App.tsx` -> `autoEscalate`
The logic to automatically upgrade priority based on due dates is currently inside the main UI component.
**Recommendation:** Move `autoEscalate` and `applyEscalationRule` into `services/dataService.ts` or a dedicated `services/workflowService.ts`.

### Type Safety
**File:** `services/dataService.ts`
Frequent use of `any` (e.g., `catch (err: any)`) bypasses TypeScript's safety.
**Recommendation:** Use `unknown` for errors or define a custom `AppError` type.

## 4. Performance

### Client-Side Heavy Lifting
The `autoEscalate` function iterates through all manuscripts on every data load. As the dataset grows, this will slow down the initial render.
**Recommendation:** Ideally, this logic should run on the backend (Supabase Edge Functions or Database Triggers) to ensure data is always correct without relying on a client opening the app.

### Gamification Recalculation
XP and stats are calculated on the fly in the client.
**Recommendation:** For a larger user base, consider caching these values or calculating them incrementally.

## 5. UI/UX

### Offline Mode
The "Offline Mode" is a great feature for resilience. However, the hardcoded "Guest Analyst" user in `App.tsx` might be confusing if a real user's network drops and they suddenly see a different name.

## 6. Action Plan

1.  **Secure Credentials:** Move Supabase keys to `.env.local` and remove hardcoded fallbacks.
2.  **Refactor App.tsx:** Move data loading and auth logic into a custom hook (e.g., `useAppData`).
3.  **Split ManuscriptList:** Extract the filter bar and table rows into separate components.
4.  **Centralize Logic:** Move business rules like escalation out of React components and into services.
