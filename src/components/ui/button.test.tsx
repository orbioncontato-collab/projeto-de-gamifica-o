import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  test('asChild passes exactly one child to Slot (regression: Slot with null + child crashed)', () => {
    render(
      <Button asChild>
        <a href="/ranking">Ver ranking</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Ver ranking' })
    expect(link.tagName).toBe('A')
    expect(link.className).toContain('inline-flex')
  })

  test('loading renders the spinner on a real button and disables it', () => {
    render(<Button loading>Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('svg')).not.toBeNull()
  })
})
