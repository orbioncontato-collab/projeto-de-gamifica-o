import { describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import { GUIDE_CHECKLIST, GUIDE_STEPS } from '../guide-steps'

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(makeBootstrap({ me: makeMe({ role: 'admin' }) })),
  useMeOptional: () => toMe(makeBootstrap({ me: makeMe({ role: 'admin' }) })),
}))

import { GuidePage } from './guide-page'

describe('GuidePage', () => {
  test('conteúdo estático: 10 passos na ordem do Apêndice C e checklist', async () => {
    expect(GUIDE_STEPS.map((s) => s.id)).toEqual([
      'settings',
      'branding',
      'code',
      'profiles',
      'rules',
      'missions',
      'challenges',
      'rewards',
      'event',
      'test',
    ])
    renderInRouter(<GuidePage />)
    expect(await screen.findByRole('heading', { name: 'Guia de uso' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getByText('Passo 1')).toBeInTheDocument()
    expect(screen.getByText('Passo 10')).toBeInTheDocument()
    for (const step of GUIDE_STEPS)
      expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
    for (const item of GUIDE_CHECKLIST) expect(screen.getByText(item.label)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver código/ })).toHaveAttribute(
      'href',
      '/admin/configuracoes?aba=codigo',
    )
  })
})
