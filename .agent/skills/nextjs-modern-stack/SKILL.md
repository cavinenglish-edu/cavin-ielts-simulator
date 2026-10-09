---
name: nextjs-modern-stack
description: >-
  Use this skill when developing, refactoring, or debugging Next.js 15/16 App Router applications with React 19, Tailwind CSS v4, and TypeScript.
---

# Next.js Modern Stack Development Guide (Next.js 15/16 + React 19 + Tailwind v4)

This skill provides expert conventions and breaking-change guards for Next.js 15/16 and React 19.

## 1. Next.js 15/16 Breaking Changes & Conventions

### Asynchronous Dynamic APIs (Crucial)
In Next.js 15+, `params` and `searchParams` passed to pages, layouts, and route handlers are **Promises**. You must await them before accessing properties.

```typescript
// ❌ WRONG (Legacy Next.js)
export default function Page({ params }: { params: { id: string } }) {
  return <div>ID: {params.id}</div>;
}

// ✅ CORRECT (Next.js 15/16)
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { query } = await searchParams;
  return <div>ID: {id}</div>;
}
```

### Server vs. Client Components Boundary
* **Server Components (Default)**: Fetch data directly (e.g. Supabase, database, fetch), keep secret keys safe, render large HTML payloads. Never use hooks (`useState`, `useEffect`) here.
* **Client Components (`'use client'`)**: Only use when interactivity is strictly required (event handlers `onClick`, state, browser APIs). Push `'use client'` to the leaf nodes of the component tree to preserve streaming and performance.

### React 19 Server Actions & Form Handling
* Always validate inputs on the server using Zod or equivalent schemas.
* Use `useActionState` (replacing deprecated `useFormState`) for handling form submission state.
* Use `useOptimistic` for instant UI feedback.

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const Schema = z.object({
  title: z.string().min(3),
});

export async function createItemAction(prevState: any, formData: FormData) {
  const validated = Schema.safeParse({
    title: formData.get('title'),
  });

  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  // Perform database mutation...
  revalidatePath('/items');
  return { success: true };
}
```

## 2. Tailwind CSS v4 Directives
* Tailwind v4 uses standard CSS `@import "tailwindcss";` in `globals.css`.
* Do not generate legacy `tailwind.config.js` or `@tailwind base;` directives unless the project explicitly uses v3.
* Custom theme extensions use `@theme { --color-*: ...; }` inside CSS.

## 3. Checklist Before Finalizing Code
1. [ ] Are all `params` and `searchParams` awaited properly?
2. [ ] Are environment secrets kept exclusively on the server (no `NEXT_PUBLIC_` for secret keys)?
3. [ ] Are image tags utilizing `next/image` with dimensions or `fill`?
4. [ ] Does `next build` or `npm run build` pass without type errors?
