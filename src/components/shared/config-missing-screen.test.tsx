import { describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { ConfigMissingScreen } from './config-missing-screen'

vi.mock('@/lib/supabase', () => ({
  missingSupabaseEnv: () => ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
  isSupabaseConfigured: () => false,
}))

describe('ConfigMissingScreen', () => {
  test('explains in pt-BR which VITE_ variables are missing', () => {
    renderWithProviders(<ConfigMissingScreen />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'O app ainda não está conectado ao Supabase',
    )
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_PUBLISHABLE_KEY')).toBeInTheDocument()
    expect(screen.getByText(/Environment Variables/)).toBeInTheDocument()
  })
})
