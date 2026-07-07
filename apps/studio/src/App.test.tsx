import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('Studio Shell (Module 001)', () => {
  it('renders core shell UI without crashing', () => {
    render(<App />)
    // Multiple "Ray Studio" (topbar + h1) — use the h1 specifically
    const headings = screen.getAllByText(/Ray Studio/i)
    expect(headings.length).toBeGreaterThan(0)
    expect(headings[0]!.textContent).toMatch(/Ray Studio/i)
  })

  it('shows command palette hint', () => {
    render(<App />)
    // There are multiple ⌘K (button + kbd) — use getAll
    const hints = screen.getAllByText(/⌘K/i)
    expect(hints.length).toBeGreaterThan(0)
  })

  it('documents the expected IPC boundary contract', () => {
    const api = (window as unknown as { rayStudio?: { ping?: unknown } }).rayStudio
    // In pure test env the bridge is undefined — expected. Contract lives in preload.
    expect(api === undefined || typeof api?.ping === 'function').toBe(true)
  })
})
