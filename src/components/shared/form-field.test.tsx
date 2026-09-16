import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from './form-field'
import { MoneyInput } from './money-input'

describe('FormField a11y wiring', () => {
  test('input inside a FormField with error gets aria-describedby pointing at the alert and aria-invalid', () => {
    render(
      <FormField label="E-mail" htmlFor="email" error="Informe um e-mail válido.">
        <Input id="email" />
      </FormField>,
    )
    const input = screen.getByLabelText('E-mail')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('id', 'email-error')
    expect(input).toHaveAttribute('aria-describedby', 'email-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Informe um e-mail válido.')
  })

  test('hint is described when there is no error, without aria-invalid', () => {
    render(
      <FormField label="XP" htmlFor="xp" hint="Pontos para subir um nível.">
        <Input id="xp" />
      </FormField>,
    )
    const input = screen.getByLabelText('XP')
    expect(input).toHaveAttribute('aria-describedby', 'xp-hint')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription('Pontos para subir um nível.')
  })

  test('error replaces hint in aria-describedby', () => {
    render(
      <FormField label="XP" htmlFor="xp" hint="Dica." error="Erro.">
        <Input id="xp" />
      </FormField>,
    )
    expect(screen.getByLabelText('XP')).toHaveAttribute('aria-describedby', 'xp-error')
    expect(screen.queryByText('Dica.')).not.toBeInTheDocument()
  })

  test('explicit aria-describedby is merged (deduplicated) with the error id', () => {
    render(
      <FormField label="Fuso" htmlFor="tz" error="Erro.">
        <Input id="tz" aria-describedby="tz-lock tz-error" />
        <span id="tz-lock">Travado.</span>
      </FormField>,
    )
    expect(screen.getByLabelText('Fuso')).toHaveAttribute('aria-describedby', 'tz-lock tz-error')
  })

  test('explicit aria-invalid={false} wins over the context', () => {
    render(
      <FormField label="Nome" htmlFor="n" error="Erro.">
        <Input id="n" aria-invalid={false} />
      </FormField>,
    )
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'false')
  })

  test('Textarea, SelectTrigger and MoneyInput are wired too', () => {
    render(
      <>
        <FormField label="Descrição" htmlFor="desc" error="Erro A.">
          <Textarea id="desc" />
        </FormField>
        <FormField label="Tipo" htmlFor="kind" error="Erro B.">
          <Select value="a">
            <SelectTrigger id="kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">A</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Meta" htmlFor="goal" error="Erro C.">
          <MoneyInput id="goal" value={null} onChange={() => undefined} />
        </FormField>
      </>,
    )
    expect(screen.getByLabelText('Descrição')).toHaveAttribute('aria-describedby', 'desc-error')
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveAttribute('aria-describedby', 'kind-error')
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Meta')).toHaveAttribute('aria-describedby', 'goal-error')
  })

  test('without htmlFor nothing is announced; outside a FormField props pass through unchanged', () => {
    render(
      <>
        <FormField label="Solto" error="Erro.">
          <Input aria-label="solto" />
        </FormField>
        <Input aria-label="fora" aria-describedby="x" />
      </>,
    )
    expect(screen.getByLabelText('solto')).not.toHaveAttribute('aria-describedby')
    expect(screen.getByLabelText('solto')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('fora')).toHaveAttribute('aria-describedby', 'x')
    expect(screen.getByLabelText('fora')).not.toHaveAttribute('aria-invalid')
  })
})
