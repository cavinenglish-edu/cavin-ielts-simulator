---
name: security-auditor
description: >-
  Use this skill when reviewing code for security vulnerabilities, inspecting API endpoints, checking authentication, or auditing dependencies and environment secrets.
---

# Web & API Security Audit Protocol

Audit and harden applications against common security vulnerabilities and data leaks.

## 1. Secrets & Credentials Protection
* **Never commit secrets**: Ensure `.env`, `.env.local`, service role keys, and private tokens are excluded in `.gitignore`.
* **Client Exposure Check**: In Next.js, verify that only public variables are prefixed with `NEXT_PUBLIC_`. All database credentials, Stripe/Supabase service role keys, and private API keys must strictly remain on the server.

## 2. Injection & Input Sanitization
* **SQL/Database Injection**: Never concatenate raw strings into SQL queries. Always use parameterized queries or ORM/query builder abstractions (e.g. Supabase client, Prisma).
* **Cross-Site Scripting (XSS)**:
  * Avoid `dangerouslySetInnerHTML` unless input is thoroughly sanitized with libraries like DOMPurify.
  * Escape user-generated content rendered in HTML or markdown.

## 3. Authentication & Authorization (IDOR)
* **Verify on Server**: Never rely on client-side role checks or hidden UI elements.
* **In Server Actions & Route Handlers**:
  1. Retrieve the authenticated user session from the server context.
  2. Verify that the user owns or is authorized to mutate/view the target entity (Insecure Direct Object Reference prevention).
  3. Validate all inputs against a strict schema (e.g. Zod).

## 4. API Endpoints & Rate Limiting
* Protect public mutation endpoints against brute-force or spam with rate limiting.
* Configure safe CORS policies and Security Headers (Content-Security-Policy, X-Frame-Options, Strict-Transport-Security).
