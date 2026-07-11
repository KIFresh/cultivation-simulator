---
name: find-skills
description: Discover and install skills from the open agent skills ecosystem with search and install commands.
---

# Find Skills

A skill that helps discover and install skills from the open agent skills ecosystem. Search for skills, find the right one for your task, and install them with a single command.

## When to Use

Use when users:
- Ask "how do I do X" for common tasks
- Request "find a skill for X"
- Ask about specialized capabilities
- Want to extend agent functionality
- Search for tools, templates, or workflows

## Skills CLI Overview

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem.
Key commands:
- Find: `npx skills find '[query]'`
- Install: `npx skills add [package] -g -y`
- List: `npx skills list -g`
- Check updates: `npx skills check`
- Update: `npx skills update`

Browse at: https://skills.sh/

## Usage Workflow

Step 1: Identify the domain and specific task
Step 2: Search using relevant queries
Step 3: Present options with skill name, install command, and skills.sh link
Step 4: Offer to install if user agrees

## Common Categories

- Web Development: react, nextjs, typescript, css, tailwind
- Testing: testing, jest, playwright, e2e
- DevOps: deploy, docker, kubernetes, ci-cd
- Documentation: docs, readme, changelog, api-docs
- Code Quality: review, lint, refactor, best-practices
- Design: ui, ux, design-system, accessibility

## Search Tips

- Use specific keywords
- Try alternative terms
- Check popular sources (vercel-labs, ComposioHQ)
- Always use English keywords for best results

## When No Skills Found

Acknowledge the gap, offer direct help, and suggest creating custom skills with `npx skills init`.

## Chinese to English Keywords

Search only supports English!
- 数据分析 → data analysis
- 做PPT → ppt, presentation
- 写文章 → writing
- 代码审查 → code review
- 部署上线 → deploy, deployment
- 写测试 → testing
- 做视频 → video, remotion
- React开发 → react
- Python开发 → python
- 前端设计 → frontend, design
- A股分析 → stock market analysis
