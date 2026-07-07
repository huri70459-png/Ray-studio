# 009 — UI Design System

**Status:** Reference (Sprint 0)

## Brand Direction
Ray Studio should feel:
- Extremely fast and keyboard-first (Raycast DNA)
- Professional, calm, and information-dense without being overwhelming
- Graph-native: the visualization of relationships is a first-class citizen
- AI-augmented but not flashy

## Core Influences
- Raycast (speed, command palette, extensions model)
- Modern developer tools (Linear, Arc, VS Code)
- Clean information architecture from the founding plan (clear separation of editor vs. memory)

## Key Surfaces
- **Global Command Palette** — primary interaction model
- **Graph Explorer** — visual + list views of entities and relationships
- **Capture Bar / Quick Input** — low-friction thought and decision capture (global hotkey)
- **Context Inspector** — shows what context will be sent to the AI for the current task
- **AI Workspaces** — scoped conversations that always pull from the graph
- **Settings & Provider Management**

## Design Tokens (initial)
- Heavy use of semantic spacing and typography
- Subtle elevation for panels
- Strong focus/hover states for keyboard navigation
- Color used purposefully (for graph node types, status, severity)
- Dark-first with excellent light mode

## Component Philosophy
- Start with a small, high-quality set of primitives
- Command items, lists, graph nodes, forms, toasts, modals
- Prefer composition
- Accessibility (full keyboard, screen reader where practical, high contrast)

## Graph Visualization
- This is a major differentiator. Invest in good:
  - Force-directed or hierarchical layouts
  - Filtering and search that updates the view live
  - Click-through from visual node to source / ADR / decision

## References
- raycast-clone-electron Design/ work in the broader workspace (for Raycast patterns)
- Founding plan's emphasis on clarity and structure
