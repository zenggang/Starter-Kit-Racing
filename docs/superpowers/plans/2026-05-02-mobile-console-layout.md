# Mobile Console Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hall and room pages into compact game-style control screens that fit mobile landscape without giant headings or scrolling.

**Architecture:** Keep the existing page routes and coordinator flows, but collapse the hall and room UI into centered console panels. Most work stays in React markup and `globals.css`; no coordinator logic changes are needed.

**Tech Stack:** Next.js App Router, React 19, global CSS, Playwright viewport verification.

---
