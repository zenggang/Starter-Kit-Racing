# Socket Primary Bridge Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the online coordinator path from bridge-first polling to WebSocket-primary with bridge fallback, and reduce Durable Object request volume.

**Architecture:** Keep the RoomCoordinator game rules unchanged, add a Durable Object WebSocket ingress plus event fanout, and change browser hooks to use socket by default and only poll through bridge after failure or resync triggers. Stabilize telemetry sending so match progress is fixed-rate with at most one in-flight request.

**Tech Stack:** Next.js App Router, React 19 hooks, Cloudflare Durable Objects, Worker WebSocket hibernation APIs, Vitest.

---
