# Google Jules REST API Reference (v1alpha)

This reference documents the empirical REST API schema for Google Jules (`jules.google`), verified against `https://jules.googleapis.com/v1alpha`.

## 1. Authentication and Base URL

* **Base URL:** `https://jules.googleapis.com/v1alpha`
* **Authentication Header:** `X-Goog-Api-Key: <JULES_API_KEY>`
* **Key Source:** Generated from the Jules Settings dashboard at [jules.google.com/settings](https://jules.google.com/settings).

## 2. Resource Endpoints

### Sources (`/v1alpha/sources`)
Lists all GitHub repositories connected to Jules via the GitHub App.

* **Method:** `GET /v1alpha/sources`
* **Response Schema:**
```json
{
  "sources": [
    {
      "name": "sources/github/OWNER/REPO",
      "id": "github/OWNER/REPO",
      "githubRepo": {
        "owner": "OWNER",
        "repo": "REPO",
        "isPrivate": false,
        "defaultBranch": {
          "displayName": "main"
        },
        "branches": [
          { "displayName": "main" }
        ]
      }
    }
  ]
}
```

### Sessions (`/v1alpha/sessions`)
Manages task runs and coding sessions.

#### Create Session
* **Method:** `POST /v1alpha/sessions`
* **Request Payload:**
```json
{
  "prompt": "Full task instructions including TDD requirements and verification commands.",
  "title": "Short descriptive title of the task",
  "sourceContext": {
    "source": "sources/github/OWNER/REPO",
    "githubRepoContext": {
      "startingBranch": "main"
    }
  },
  "requirePlanApproval": false,
  "automationMode": "AUTO_CREATE_PR"
}
```

#### Get Session Status
* **Method:** `GET /v1alpha/sessions/{id}`
* **Response Properties:**
  * `state`: One of `QUEUED`, `PLANNING`, `AWAITING_PLAN_APPROVAL`, `AWAITING_USER_FEEDBACK`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `FAILED`.
  * `outputs`: Array containing created artifacts, including:
    ```json
    [
      {
        "pullRequest": {
          "url": "https://github.com/OWNER/REPO/pull/123",
          "number": 123
        }
      }
    ]
    ```

#### Approve Plan
* **Method:** `POST /v1alpha/sessions/{id}:approvePlan`
* **Body:** `{}`

#### Send Message / Steer Session
* **Method:** `POST /v1alpha/sessions/{id}:sendMessage`
* **Body:** `{"prompt": "Follow-up instructions or bug-fix guidance"}`

#### Session Activities
* **Method:** `GET /v1alpha/sessions/{id}/activities?pageSize=50`
* Returns progress updates, planning artifacts, and unidiff patch data.

## 3. Dual-Agent Invocation Protocol

1. **Phase 1 (Implementation):**
   * Target: `startingBranch: "main"` (or feature integration branch).
   * Result: Jules Coder Agent generates PR branch `jules-...`.
2. **Phase 2 (Testing & Verification):**
   * Target: `startingBranch: "<coder-pr-branch>"`.
   * Prompt: Instructs Jules Tester Agent to inspect diff, author negative and boundary tests, and verify tests pass.
