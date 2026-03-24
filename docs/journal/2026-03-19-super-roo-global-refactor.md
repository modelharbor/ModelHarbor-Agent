# SuperRoo Global Config Experiment Revert and Self-Contained Decision

**Date:** 2026-03-19

## Summary

We briefly experimented with moving shared SuperRoo configuration from the project-local `.roo/` directory into a developer-global `~/.roo/` location.

That experiment was reverted.

The final state is that this repository keeps the authoritative SuperRoo configuration inside project `.roo/`, so the repo is self-contained and a fresh checkout of ModelHarbor Agent includes the required commands, rules, docs, guidance, and skills immediately.

## Experiment

The original idea behind the experiment was reasonable:

- reduce duplication of reusable SuperRoo workflow files
- make generic commands available across repositories
- separate reusable methodology from repo-specific guidance

During the experiment, some command and workflow material was treated as candidate global content under `~/.roo/`.

## Why We Reverted

We reverted because the global-first layout weakened one of the most important properties of this repository: anyone installing or cloning ModelHarbor Agent should get a complete working configuration directly from version control.

Keeping part of the configuration outside the repository introduced several problems:

- setup became machine-dependent because correctness now depended on local files outside the repo
- onboarding became less reliable because a fresh checkout was no longer guaranteed to contain the full SuperRoo configuration
- verification became less clear because some expected files existed only in a developer environment
- the repository stopped being a complete source of truth for its own behavior

For this project, self-contained configuration is more important than cross-repo reuse.

## Final Decision

The final decision is to keep project `.roo/` as the source of truth.

This means:

- project `.roo/` is authoritative
- project `.roo/` must remain self-contained
- the repository must include the commands, rules, skills, docs, and guidance needed by ModelHarbor Agent
- any developer-global copy may exist locally, but it is not the deployment strategy and must not be treated as required for this repo

## Final Architecture

```text
.roo/                                      ← Authoritative and self-contained
├── commands/                              ← 12 files
├── docs/                                  ← 1 file
├── guidance/                              ← 1 file
├── rules/                                 ← 2 files
├── rules-code/                            ← 1 file
├── rules-debug/                           ← 1 file
├── rules-docs-extractor/                  ← 3 files
├── rules-issue-fixer/                     ← 9 files
├── rules-issue-investigator/              ← 6 files
├── rules-issue-writer/                    ← 4 files
├── rules-merge-resolver/                  ← 5 files
├── rules-pr-fixer/                        ← 5 files
├── rules-translate/                       ← 4 files
└── skills/                                ← 3 skill directories

C:/Users/Korn/.roo/                        ← Optional developer convenience only
└── (may still exist on a dev machine)     ← Not authoritative, not required by repo
```

## Verification

Recursive inventory check of project `.roo/` confirms the repository is back to the expected self-contained layout:

- `.roo/commands/` = 12 files
- `.roo/rules/` = 2 files
- `.roo/rules-code/` = 1 file
- `.roo/rules-debug/` = 1 file
- `.roo/rules-docs-extractor/` = 3 files
- `.roo/rules-issue-fixer/` = 9 files
- `.roo/rules-issue-investigator/` = 6 files
- `.roo/rules-issue-writer/` = 4 files
- `.roo/rules-merge-resolver/` = 5 files
- `.roo/rules-pr-fixer/` = 5 files
- `.roo/rules-translate/` = 4 files
- `.roo/skills/` = 3 skill directories
- `.roo/docs/` = 1 file
- `.roo/guidance/` = 1 file

Result: the repo has been restored to a self-contained `.roo/` structure.

## Notes on Global Copies

A global copy under `C:/Users/Korn/.roo/` may still exist on the development machine from the experiment.

That is acceptable as local developer convenience, but it is explicitly not the deployment model for this repository. The project should be considered correct only when the required configuration is present in project `.roo/`.

## Operational Guidance

Going forward:

- update the repository copy first
- treat project `.roo/` as the authoritative configuration
- do not rely on developer-global `.roo/` contents for repo correctness
- do not delete global files as part of this journal update; they are merely out of scope for deployment strategy

## Outcome

The experiment produced a useful conclusion: for ModelHarbor Agent, self-contained project configuration is the right architecture.

Project `.roo/` is the authoritative source of truth, and any global `C:/Users/Korn/.roo/` copy is optional convenience only.
