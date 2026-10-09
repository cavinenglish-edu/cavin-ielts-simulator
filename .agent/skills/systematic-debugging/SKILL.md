---
name: systematic-debugging
description: >-
  Use this skill when diagnosing, troubleshooting, or fixing bugs, runtime errors, test failures, or build issues.
---

# Systematic Debugging Protocol

When encountering a bug, build error, or unexpected behavior, follow this 4-step protocol strictly. Avoid random guessing or making speculative code changes.

## Step 1: Root Cause Analysis & Reproduction
1. **Gather Evidence**: Inspect terminal logs, stack traces, browser console errors, and network request payloads.
2. **Isolate the Failure**: Determine the exact file, function, line number, or API call causing the failure.
3. **Check Inputs & Assumptions**: Identify what data was passed vs. what data was expected (types, null/undefined, async promises).

## Step 2: Formulate & Test Hypotheses
1. Formulate a specific hypothesis: *"The error occurs because X is undefined during initial server render before hydration."*
2. Verify the hypothesis by checking code flow, logging key values, or reading documentation before editing the implementation.

## Step 3: Minimal, Clean Fix
1. Apply the simplest, most robust fix that addresses the root cause rather than patching over symptoms.
2. Ensure types are properly updated and edge cases (empty states, errors, timeouts) are handled gracefully.

## Step 4: Verification & Regression Check
1. Re-run the reproduction command (or trigger the same action in browser via Chrome DevTools).
2. Run project linters and build checks (`npm run lint`, `npm run build`).
3. Ensure adjacent functionality was not broken by the fix.
