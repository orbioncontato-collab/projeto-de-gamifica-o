import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import type { Branding } from '@/lib/database.types'

const getBranding = vi.fn()
vi.mock('./api', () => ({ getBranding: (...a: unknown[]) => getBranding(...a) }))

import { Brand } from '@/components/layout/brand'
import { BrandingProvider } from './branding-provider'
import { fileToLogoDataUrl, LogoFileError } from './logo-file'
import { BRAND_PRESETS, isBrandPreset } from './presets'

const ACME: Branding = {
  company_name: 'Acme',
  platform_name: 'Liga Acme',
  brand_preset: 'safira',
  logo_data_url: null,
  default_theme: 'light',
}
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

beforeEach(() => {
  getBranding.mockReset().mockResolvedValue(ACME)
  localStorage.clear()
  document.documentElement.dataset['theme'] = 'dark'
  delete document.documentElement.dataset['brand']
  document.title = ''
})
afterEach(() => {
  delete document.documentElement.dataset['brand']
})

describe('presets', () => {
  test('7 presets, esmeralda primeiro; isBrandPreset rejeita valor desconhecido', () => {
    expect(BRAND_PRESETS).toHaveLength(7)
    expect(BRAND_PRESETS[0]?.id).toBe('esmeralda')
    expect(isBrandPreset('coral')).toBe(true)
    expect(isBrandPreset('neon')).toBe(false)
  })
})

describe('Brand', () => {
  test('mostra o padrão enquanto carrega e depois a marca do cliente (empresa + plataforma)', async () => {
    renderWithProviders(<Brand />)
    expect(screen.getByText('Orbion')).toBeInTheDocument()
    expect(screen.getByText('Sales League')).toBeInTheDocument()
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Liga Acme')).toBeInTheDocument()
    expect(screen.queryByTestId('brand-logo')).not.toBeInTheDocument()
  })

  test('com logo enviada, renderiza a imagem no lugar do símbolo; compacto vira texto só para leitor de tela', async () => {
    getBranding.mockResolvedValue({ ...ACME, logo_data_url: PNG_1PX })
    renderWithProviders(<Brand compact />)
    const img = await screen.findByTestId('brand-logo')
    expect(img).toHaveAttribute('src', PNG_1PX)
    expect(screen.getByText('Acme Liga Acme')).toHaveClass('sr-only')
  })
})

describe('BrandingProvider', () => {
  test('aplica html[data-brand], o título da aba e o tema padrão quando não há preferência salva', async () => {
    renderWithProviders(
      <BrandingProvider>
        <span>ok</span>
      </BrandingProvider>,
    )
    await waitFor(() => expect(document.documentElement.dataset['brand']).toBe('safira'))
    expect(document.title).toBe('Acme Liga Acme')
    expect(document.documentElement.dataset['theme']).toBe('light')
    expect(localStorage.getItem('orbion-theme')).toBeNull() // tema padrão não vira preferência
  })

  test('preferência salva do usuário vence o tema padrão da marca', async () => {
    localStorage.setItem('orbion-theme', 'dark')
    renderWithProviders(
      <BrandingProvider>
        <span>ok</span>
      </BrandingProvider>,
    )
    await waitFor(() => expect(document.documentElement.dataset['brand']).toBe('safira'))
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  test('preset desconhecido vindo do banco cai para esmeralda', async () => {
    getBranding.mockResolvedValue({ ...ACME, brand_preset: 'neon' as Branding['brand_preset'] })
    renderWithProviders(
      <BrandingProvider>
        <span>ok</span>
      </BrandingProvider>,
    )
    await waitFor(() => expect(document.documentElement.dataset['brand']).toBe('esmeralda'))
  })
})

describe('fileToLogoDataUrl', () => {
  test('rejeita tipo não suportado', async () => {
    const file = new File(['x'], 'logo.gif', { type: 'image/gif' })
    await expect(fileToLogoDataUrl(file)).rejects.toBeInstanceOf(LogoFileError)
  })

  test('SVG vira data-URL base64 sem processamento', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'
    const file = new File([svg], 'logo.svg', { type: 'image/svg+xml' })
    const url = await fileToLogoDataUrl(file)
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(atob(url.split(',')[1] ?? '')).toBe(svg)
  })

  test('PNG pequeno passa como está', async () => {
    const bytes = Uint8Array.from(atob(PNG_1PX.split(',')[1] ?? ''), (c) => c.charCodeAt(0))
    const file = new File([bytes], 'logo.png', { type: 'image/png' })
    expect(await fileToLogoDataUrl(file)).toBe(PNG_1PX)
  })

  test('SVG acima do limite é rejeitado', async () => {
    const file = new File(['<svg>' + 'x'.repeat(300_000) + '</svg>'], 'big.svg', { type: 'image/svg+xml' })
    await expect(fileToLogoDataUrl(file)).rejects.toThrow(/grande demais/)
  })
})
