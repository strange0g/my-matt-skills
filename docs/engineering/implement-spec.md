## What it does

`implement-spec` takes a [spec](https://www.aihero.dev/ai-coding-dictionary/spec) and its [tickets](https://www.aihero.dev/ai-coding-dictionary/ticket) and lands the entire build by orchestrating parallel Google Jules (`jules.google`) cloud sessions. The local harness manages the **frontier** of unblocked tickets, dispatches Jules Coder Agents in parallel, runs the mandatory Jules Tester Agent on every opened Pull Request, merges verified PRs into a single **integration branch**, runs [code-review](https://aihero.dev/skills-code-review), and presents a consolidated executive summary for user sign-off.

It reads the tickets as a **task graph**, not a list. Blocking edges decide what can start, so at any moment there is a frontier of tickets whose blockers have landed, and every unblocked ticket is dispatched to Jules simultaneously.

## When to reach for it

You invoke this by typing `/implement-spec`, and the agent won't reach for it on its own.

| Your situation | Reach for |
| --- | --- |
| A spec, split into tickets with blocking edges, that you want landed in one run | `/implement-spec` |
| One ticket at a time, in your own context window | [implement](https://aihero.dev/skills-implement) |
| A spec that isn't split into tickets yet | [to-tickets](https://aihero.dev/skills-to-tickets) first |
| A small piece of work with no real graph to it | [implement](https://aihero.dev/skills-implement) directly |

## Prerequisites

- **Google Jules Access:** `JULES_API_KEY` set in your environment or `.env`, and repo connected to the Jules GitHub App.
- **An issue tracker:** The skill reads tickets from the tracker configured by [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills).
- **Tickets with blocking edges**, as [to-tickets](https://aihero.dev/skills-to-tickets) writes them.

## The integration branch

Everything lands on one branch. For each frontier ticket:

1. The orchestrator dispatches a Jules Coder Agent targeting the integration branch.
2. When the Coder Agent opens a PR, a Jules Tester Agent runs deep adversarial and boundary tests in its Cloud VM.
3. The local harness fetches the verified PR branch and runs read-only tests.
4. Green PRs are merged into the integration branch, unblocking downstream tickets until the entire graph is resolved.
5. On completion, the harness generates an Executive Summary with test evidence for user approval.

## Common questions

**How is this different from running `/implement` on each ticket myself?**

This is the question the skill exists to answer. Before it shipped, people kept building their own versions, and one user described the itch exactly: they wanted "subagents implement the tickets" instead of having "to individually create new session and tell them to implement a ticket one by one, when a spec may contain over 5 tickets." With `implement` you are the dispatcher: one [session](https://www.aihero.dev/ai-coding-dictionary/session) per ticket, clearing in between, and keeping track yourself of which tickets are unblocked. `implement-spec` hands that job to one orchestrating session. The price is that you no longer read each ticket's work as it lands; you review the integration branch at the end. To start a run, clear the context and type `/implement-spec` with a pointer to the spec (an issue number or a file path). For a small change with no real graph, skip it and use `implement` directly.

**Does it need GitHub? I want it to stop at the branch.**

No, not any more. One user who liked the in-progress version had exactly this complaint: "it creates a PR at the end, which requires an online repository like GitHub. I wish it could do the same work offline and stop at the branch where all the work is merged." The goal is now the integration branch. A PR opens only when the configured tracker closes work through PRs or you ask for one, so on a local markdown tracker the run ends with every ticket resolved and the work merged on the branch.

**Its review and fix loop ran for hours, or kept "fixing" tickets that hadn't been built yet.**

Both come from `code-review` running outside the one slot the skill gives it. It compares the code against the whole spec, so it only makes sense once every ticket has landed; run it mid-run and every unbuilt ticket reads as a failure, the agent sets about building it, and that triggers another review. At the end, the skill runs `code-review` once and sends every finding to one fix subagent, but it doesn't yet say when to stop after that fix. One user reported a five-ticket feature where "the review and fix loop took roughly four hours". If you see a second broad review start, tell it to run focused checks for the fixed findings and stop. Expect that first review to find real problems: the run's output is a draft that the review finishes, not something to ship on its own.

**Does it drive tdd like implement does?**

It does now, though it didn't at first. Users running the in-progress version noticed that "the implementer subagents don't inherit the /tdd directive", so red-green dropped out the moment they scaled up from one ticket to a whole spec. Each implementer now builds its ticket with `tdd`. There is still no step where seams get agreed interactively, as there is in an `implement` session, so name the seams in the spec or the tickets if you want them pinned.

**Two implementers running in parallel collided on the same file, or picked different names for the same thing.**

Worktrees don't remove collisions; they postpone them to merge time. A blocking edge written from ticket text is a guess about which files each ticket will touch, and two tickets on "different parts of the codebase" still share a message catalogue, a config registry, or a type. Each implementer sees only its own ticket and the shared notes, never the other's work in progress, so one user's web and mobile tickets added the same string as `blockedSince` and `blockedOn`. When two frontier tickets touch one shared surface, either add a blocking edge between them so they run one after the other, or have the exploration notes fix the exact names each ticket adds.

**Blocked tickets never start, even after their blocker has merged.**

A known rough edge on GitHub. The tracker's blocked-by count only drops when a blocker *closes*, and tickets typically close when the PR merges, which is the end of the run. The tracker is the right source for the starting graph but a stale one mid-run. Tell the orchestrator to track which tickets have merged into the integration branch itself and compute the frontier from that.

**Does this replace Sandcastle or an AFK script?**

No. People ask because the skills now reach into implementation: "is Sandcastle still relevant? Your skills now seem to be able to handle implementation as well." `implement-spec` puts an agent in charge of orchestration inside one harness session, which needs no infrastructure and lets you watch and steer. For work that is truly [AFK](https://www.aihero.dev/ai-coding-dictionary/afk), a deterministic loop ([Sandcastle](https://github.com/mattpocock/sandcastle), a shell script, a CI job) is faster, cheaper, and more reliable, because no part of the orchestration can wander off.

**A ticket's key test was skipped inside its worktree, and it reported green.**

A worktree holds only what git tracks. Tests that read gitignored fixtures, local databases, or credentials can skip themselves there silently. For a ticket whose verification depends on untracked material, tell the orchestrator to run it in the main checkout instead.

## It's working if

- Several implementers are running at once whenever the graph allows, not one after another.
- A ticket starts as soon as its last blocker lands on the integration branch, not when the whole run ends.
- Every ticket's trace shows `tdd` running, with a failing test before the code.
- Merges into the integration branch are fast-forwards, not conflict resolutions.
- The run ends on one branch with every ticket resolved, and a PR only if your tracker wanted one.

## Where it fits

`implement-spec` is the build step of the main chain, as the parallel alternative to running [implement](https://aihero.dev/skills-implement) once per ticket:

```txt
grill-with-docs → to-spec → to-tickets → implement-spec → retro
```

Its neighbours are [to-tickets](https://aihero.dev/skills-to-tickets), which declares the blocking edges it reads as a task graph, and [code-review](https://aihero.dev/skills-code-review), which it runs over the integration branch before closing out. [ask-matt](https://aihero.dev/skills-ask-matt) is the router over the whole set when you are not sure which flow you are in.
