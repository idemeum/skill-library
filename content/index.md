---
title: AI Support Agent Skill Library
---

# Library

This library contains skills and tools for the AI Support Agent.

<div class="stat-cards">
  <a class="stat-card" href="/skills/">
    <span class="stat-card-number">{{skills-count}}</span>
    <span class="stat-card-label">Skills</span>
  </a>
  <a class="stat-card" href="/tools/">
    <span class="stat-card-number">{{tools-count}}</span>
    <span class="stat-card-label">Tools</span>
  </a>
</div>

## Skills

Skills are instructions written in Markdown that teach the [AI Support Agent](https://idemeum.com/ai-support-agent) how to resolve specific endpoint issues. For example, [disk-cleanup](/skills/disk-cleanup/disk-cleanup) frees up storage, and [process-manager](/skills/process-manager/process-manager) diagnoses slow computers. Each skill defines when to use it, what steps to follow, and which tools it can invoke. Skills contain: 

| Section         | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| **Frontmatter** | Top YAML block that declares structured metadata like the skill's name, risk level, allowed tools. etc. |
| **Body**        | Plain Markdown with the agent's playbook: when to use the skill, the steps to take, edge cases, etc. |

## Tools

Tools are executable capabilities the AI agent can invoke from inside the skill. These are narrowly scoped **deterministic** functions like [kill_process](/tools/kill_process) or [list_printers](/tools/list_printers) that perform one well-defined action and returns a structured result. Tools contain:

| Section        | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| **Meta block** | Declares structured metadata such as the tool's name, description, risk level, whether it requires user consent, etc. |
| **Body**       | Actual code that runs when the agent calls the tool, including any platform-specific branches (macOS vs Windows), error handling, and the shape of the data it returns. |
