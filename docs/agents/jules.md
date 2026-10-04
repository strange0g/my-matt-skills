# Google Jules Delegation Guide

This document describes the autonomous delegation framework for Google Jules (`jules.google`), establishing how local harnesses collaborate with remote Jules agents.

## 1. Division of Responsibility

* **The User:** Sets strategic direction, answers questions requiring human judgement in Wayfinder, and reviews executive summaries for major milestone merges.
* **Local Harness (Antigravity, Claude Code, Cursor, Codex):** The **Architect and Planner**. Handles user interviewing, domain modeling, ticket authoring, task graph orchestration, and multi-tier read-only test verification. It never directly creates or edits source code or test files in the repository.
* **Google Jules (`jules.google`):** The **Autonomous Implementer**. Executes in an isolated Google Cloud VM with GitHub App access.

## 2. Dual-Agent Jules Pipeline

For every implementation task, the framework runs a two-phase Jules pipeline:

### Phase 1: Jules Coder Agent
* **Trigger:** Dispatched via `node scripts/jules.mjs dispatch --prompt "..."`.
* **Execution:** Auto-approves the generated plan, writes code test-first (red-green TDD), runs tests in its Cloud VM, and opens a Pull Request.

### Phase 2: Jules Tester Agent (Mandatory for ALL PRs)
* **Trigger:** Dispatched automatically upon PR creation via `node scripts/jules.mjs dispatch-tester --pr-branch "<branch>" --prompt "..."`.
* **Execution:** Checks out the PR branch, inspects the diff, authors edge-case, boundary, and regression tests in its Cloud VM, and verifies the full test suite before reporting back.

## 3. Merge Policy

1. **Automated Verification:** The local harness checks out the PR branch and runs read-only test suites and linters.
2. **Routine Scoped PRs:** When both the Coder Agent and Tester Agent pass and the diff is scoped, the PR is merged automatically via `gh pr merge --squash --auto`.
3. **Major Milestones and Spec Completions:** When completing full multi-ticket specs or core architecture updates, the harness generates an Executive Summary with test evidence for user sign-off before merging.
