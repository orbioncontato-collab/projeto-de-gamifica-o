import { useEffect, useRef, useState } from 'react'
import { Controller } from 'react-hook-form'
import { Check, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/form-field'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { BrandMark } from '@/components/layout/brand-mark'
import { useZodForm } from '@/lib/forms'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type { AppSettingsPatch, AppSettingsRow } from '@/lib/database.types'
import { applyBrandPreset } from '@/features/branding/branding-provider'
import { fileToLogoDataUrl, LogoFileError } from '@/features/branding/logo-file'
import { BRAND_PRESETS, LOGO_MIME, PLATFORM_NAME_MAX } from '@/features/branding/presets'
import { useUpdateAppSettings } from '../hooks'
import { brandingFormSchema, type BrandingFormInput, type BrandingFormValues } from '../schemas'

export interface BrandingFormProps {
  settings: AppSettingsRow
}

const defaultsOf = (s: AppSettingsRow): BrandingFormInput => ({
  platformName: s.platform_name,
  brandPreset: s.brand_preset,
  defaultTheme: s.default_theme,
})

/**
 * Aba "Marca": nome da plataforma, preset de cor (7), logo (data-URL) e tema padrão.
 * O preset escolhido é pré-visualizado no app inteiro enquanto a aba está aberta; ao sair
 * sem salvar, volta ao que está no banco.
 */
export function BrandingForm({ settings }: BrandingFormProps) {
  const update = useUpdateAppSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  // undefined = não mexeu; null = remover; string = nova logo
  const [logo, setLogo] = useState<string | null | undefined>(undefined)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const form = useZodForm<BrandingFormInput, BrandingFormValues>(brandingFormSchema, defaultsOf(settings))
  const { register, control, handleSubmit, reset, watch, formState } = form
  const { errors, isDirty } = formState
  const preset = watch('brandPreset')

  useEffect(() => {
    reset(defaultsOf(settings))
    setLogo(undefined)
  }, [settings, reset])

  // pré-visualização ao vivo do preset; restaura o salvo ao desmontar
  useEffect(() => {
    applyBrandPreset(preset)
  }, [preset])
  useEffect(() => () => applyBrandPreset(settings.brand_preset), [settings.brand_preset])

  const currentLogo = logo === undefined ? settings.logo_data_url : logo
  const busy = update.isPending || reading
  const dirty = isDirty || logo !== undefined

  const pickFile = async (file: File) => {
    setReading(true)
    setLogoError(null)
    try {
      setLogo(await fileToLogoDataUrl(file))
    } catch (error) {
      const message = error instanceof LogoFileError ? error.message : 'Não foi possível processar a imagem.'
      setLogoError(message)
      notify.error(message)
    } finally {
      setReading(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const patch: AppSettingsPatch = {}
    if (values.platformName !== settings.platform_name) patch.platform_name = values.platformName
    if (values.brandPreset !== settings.brand_preset) patch.brand_preset = values.brandPreset
    if (values.defaultTheme !== settings.default_theme) patch.default_theme = values.defaultTheme
    if (logo !== undefined && logo !== settings.logo_data_url) patch.logo_data_url = logo
    if (Object.keys(patch).length === 0) return
    await update.mutateAsync(patch)
    setLogo(undefined)
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <PremiumCard as="section" padding="lg">
        <SectionHeader eyebrow="Marca" title="Identidade da plataforma" />
        <p className="mt-1 text-sm text-muted">
          Aparece na barra lateral, no topo, na tela de login e no título da aba do navegador. O nome da
          empresa fica na aba Geral.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <FormField
            label="Nome da plataforma"
            htmlFor="platform-name"
            error={errors.platformName?.message}
            hint={`Até ${PLATFORM_NAME_MAX} caracteres. Ex.: "Liga de Vendas", "Arena Comercial".`}
            required
          >
            <Input
              id="platform-name"
              maxLength={PLATFORM_NAME_MAX}
              disabled={busy}
              {...register('platformName')}
            />
          </FormField>
          <div className="flex items-center gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface px-3 py-2">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt=""
                data-testid="branding-logo-preview"
                className="h-10 w-10 rounded-2xl object-contain"
              />
            ) : (
              <div
                className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-accent-fg"
                aria-hidden="true"
              >
                <BrandMark className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-black tracking-tight text-text">
                {settings.company_name}
              </div>
              <div className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                {watch('platformName') || settings.platform_name}
              </div>
            </div>
          </div>
        </div>
      </PremiumCard>

      <PremiumCard as="section" padding="lg">
        <SectionHeader eyebrow="Cor" title="Cor de destaque" />
        <p className="mt-1 text-sm text-muted">
          Botões, links, ícones e destaques. Todas as opções mantêm contraste legível nos temas escuro e
          claro.
        </p>
        <Controller
          control={control}
          name="brandPreset"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Cor de destaque"
              className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
            >
              {BRAND_PRESETS.map((p) => {
                const selected = field.value === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={p.label}
                    data-brand={p.id}
                    disabled={busy}
                    onClick={() => field.onChange(p.id)}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-[var(--radius-ctl)] border px-3 py-2 text-left transition',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-line bg-surface hover:bg-surface-hover',
                    )}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"
                      aria-hidden="true"
                    >
                      {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-text">{p.label}</span>
                      <span className="block text-[11px] text-muted">{p.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        />
      </PremiumCard>

      <PremiumCard as="section" padding="lg">
        <SectionHeader eyebrow="Logo" title="Logo da empresa" />
        <p className="mt-1 text-sm text-muted">
          Opcional. Substitui o símbolo padrão no quadrado da marca — prefira um símbolo quadrado (logos
          horizontais ficam pequenas). PNG, JPG, WebP ou SVG; imagens grandes são reduzidas automaticamente e
          ficam guardadas no próprio banco, sem configuração extra.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept={LOGO_MIME.join(',')}
            className="sr-only"
            aria-label="Arquivo da logo"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void pickFile(file)
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={reading}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            {currentLogo ? 'Trocar logo' : 'Enviar logo'}
          </Button>
          {currentLogo ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setLogo(null)}>
              <Trash2 aria-hidden="true" />
              Remover logo
            </Button>
          ) : null}
          {logoError ? (
            <span role="alert" className="text-xs font-semibold text-red-soft">
              {logoError}
            </span>
          ) : null}
        </div>
      </PremiumCard>

      <PremiumCard as="section" padding="lg">
        <SectionHeader eyebrow="Tema" title="Tema padrão" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField
            label="Tema inicial"
            htmlFor="default-theme"
            error={errors.defaultTheme?.message}
            hint="Vale para quem ainda não escolheu o próprio tema no botão da barra superior."
          >
            <Controller
              control={control}
              name="defaultTheme"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                  <SelectTrigger id="default-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Escuro</SelectItem>
                    <SelectItem value="light">Claro</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!dirty || busy}>
            Salvar marca
          </Button>
        </div>
      </PremiumCard>
    </form>
  )
}
