---
name: tdd-workflow
description: >-
  Use this skill when implementing new features, writing tests, or practicing Test-Driven Development (TDD).
---

# Test-Driven Development (TDD) Workflow

Follow the Red-Green-Refactor discipline to ensure high code quality, prevent regressions, and build self-documenting codebases.

## 1. Red Phase: Write Failing Test First
* Define the expected behavior as a test case before writing any implementation code.
* Cover:
  * Happy path (valid inputs and expected outputs).
  * Edge cases (empty arrays, null/undefined, extreme values).
  * Error cases (invalid formats, missing authentication, rejected promises).
* Run the test suite to confirm the test fails for the expected reason (not due to syntax or test config errors).

## 2. Green Phase: Make It Pass
* Write the minimal amount of code necessary to make the failing test pass.
* Do not over-engineer or prematurely optimize at this stage.
* Run tests to confirm green status.

## 3. Refactor Phase: Clean & Polish
* Clean up the code while keeping tests green:
  * Eliminate code duplication.
  * Improve naming and readability.
  * Enforce strict typing.
* Verify that all tests remain green after refactoring.

## 4. Test Verification Standard
* Fast execution: Unit tests should run within seconds.
* Isolated: Tests should not depend on external network states unless explicitly testing an integration with mocked responses.
