import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RotateCcw, Save } from 'lucide-react'
import type { WheelKind } from '@/lib/database.types'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import { useMe } from '@/features/auth/bootstrap-query'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PageFrame } from '@/components/shared/page-frame'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { ErrorState } from '@/components/shared/error-state'
import { ListSkeleton, WheelSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WHEEL_KINDS } from '../api'
import { useSaveWheelPrizes, useWheelConfig, useWheelRealtime } from '../hooks'
import {
  draftsFromRows,
  isDirty,
  moveDraft,
  newDraft,
  validateDrafts,
  type ValidationResult,
} from '../prize-editor-state'
import { MAX_PRIZES, MIN_PRIZES, toSavePrizeInputs } from '../schemas'
import { PrizeEditorRow, type PrizeDraft } from './prize-editor-row'
import { Wheel } from './wheel'
import { WheelSelector } from './wheel-selector'
import '../wheel.css'

const NO_ERRORS: ValidationResult = { values: null, rowErrors: {}, listErrors: [] }

/** /admin/roleta — duas colunas: lista editável (rótulo, tipo, valor, peso, cor, ordem, ativo) + pré-visualização. */
export function PrizeEditor() {
  const { settings } = useMe()
  const config = useWheelConfig()
  const save = useSaveWheelPrizes()
  useWheelRealtime()
  const [kind, setKind] = useState<WheelKind>('classic')
  const [drafts, setDrafts] = useState<PrizeDraft[]>([])
  const [baseline, setBaseline] = useState<PrizeDraft[]>([])
  const [validation, setValidation] = useState<ValidationResult>(NO_ERRORS)
  const [pendingKind, setPendingKind] = useState<WheelKind | null>(null)
  const baselineRef = useRef<PrizeDraft[]>([])

  const rows = config.data?.[kind].prizes
  const dirty = isDirty(baseline, drafts)

  // Recarrega os rascunhos quando muda a roleta ou quando o banco muda (realtime) e não há edição em curso.
  useEffect(() => {
    if (!rows) return
    const fresh = draftsFromRows(kind, rows)
    const previous = baselineRef.current
    baselineRef.current = fresh
    setBaseline(fresh)
    setDrafts((current) => (current.length > 0 && isDirty(previous, current) ? current : fresh))
    setValidation(NO_ERRORS)
  }, [rows, kind])

  const preview = useMemo(
    () =>
      drafts
        .filter((d) => d.is_active)
        .map((d) => ({ id: d.key, label: d.label || '—', color: d.color || null })),
    [drafts],
  )
  const prizeCounts: Record<WheelKind, number> = {
    classic: config.data?.classic.prizes.length ?? 0,
    premium: config.data?.premium.prizes.length ?? 0,
  }

  const patchDraft = (index: number, patch: Partial<PrizeDraft>) =>
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  const onSave = async () => {
    const result = validateDrafts(drafts)
    setValidation(result)
    if (!result.values) return
    let saved
    try {
      saved = await save.mutateAsync({ wheelKind: kind, prizes: toSavePrizeInputs(result.values) })
    } catch {
      return // toast global: SPIN_PENDING, MIN_PRIZES, MYSTERY_NEEDS_POOL, SORT_ORDER_DUPLICATE…
    }
    const fresh = draftsFromRows(kind, saved)
    setBaseline(fresh)
    setDrafts(fresh)
  }

  const onReset = () => {
    setDrafts(baseline)
    setValidation(NO_ERRORS)
  }

  const switchKind = (next: WheelKind) => {
    baselineRef.current = []
    setBaseline([])
    setDrafts([])
    setValidation(NO_ERRORS)
    setKind(next)
  }
  const onKindChange = (next: WheelKind) => {
    if (next === kind) return
    if (dirty) setPendingKind(next)
    else switchKind(next)
  }

  return (
    <PageFrame
      eyebrow="Administração"
      title="Editor da roleta"
      subtitle={`Prêmios de cada roleta. Mínimo ${MIN_PRIZES}, máximo ${MAX_PRIZES}. Não é possível salvar com giro aguardando aprovação.`}
      action={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={!dirty || save.isPending} onClick={onReset}>
            <RotateCcw aria-hidden="true" /> Desfazer
          </Button>
          <Button
            type="button"
            disabled={!dirty || !config.isSuccess}
            loading={save.isPending}
            onClick={() => void onSave()}
          >
            <Save aria-hidden="true" /> Salvar prêmios
          </Button>
        </div>
      }
    >
      <Tabs value={kind} onValueChange={(v) => onKindChange(v as WheelKind)} className="mb-5">
        <TabsList aria-label="Roleta em edição">
          {WHEEL_KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {WHEEL_KIND_LABELS[k]} ({prizeCounts[k]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <PremiumCard as="section" aria-label="Lista de prêmios">
          <SectionHeader
            eyebrow={WHEEL_KIND_LABELS[kind]}
            title={`${drafts.length} prêmios`}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!config.isSuccess || drafts.length >= MAX_PRIZES || save.isPending}
                onClick={() => setDrafts((l) => [...l, newDraft(kind, l.length)])}
              >
                <Plus aria-hidden="true" /> Adicionar prêmio
              </Button>
            }
          />
          {config.isPending ? (
            <ListSkeleton rows={6} />
          ) : config.isError ? (
            <ErrorState error={config.error} onRetry={() => void config.refetch()} compact />
          ) : (
            <>
              {validation.listErrors.length > 0 ? (
                <ul
                  role="alert"
                  className="mb-3 list-disc rounded-xl border border-red/25 bg-red/10 px-6 py-2 text-sm text-red-soft"
                >
                  {validation.listErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              {drafts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  Nenhum prêmio. Adicione pelo menos {MIN_PRIZES} para a roleta funcionar.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {drafts.map((draft, index) => (
                    <PrizeEditorRow
                      key={draft.key}
                      draft={draft}
                      index={index}
                      total={drafts.length}
                      errors={validation.rowErrors[index]}
                      disabled={save.isPending}
                      onChange={(patch) => patchDraft(index, patch)}
                      onMove={(dir) => setDrafts((l) => moveDraft(l, index, dir))}
                      onRemove={() => setDrafts((l) => l.filter((_, i) => i !== index))}
                    />
                  ))}
                </ol>
              )}
            </>
          )}
        </PremiumCard>

        <PremiumCard
          as="section"
          className="wheel-panel flex flex-col items-center gap-4"
          data-kind={kind}
          aria-label="Pré-visualização"
        >
          <WheelSelector value={kind} onChange={onKindChange} locked={false} prizeCounts={prizeCounts} />
          {config.isPending ? (
            <WheelSkeleton />
          ) : (
            <Wheel kind={kind} prizes={preview} rotation={0} spinning={false} winnerIndex={null} />
          )}
          <p className="text-center text-xs text-muted">
            Pré-visualização com {preview.length} setores ativos. A roleta de todos atualiza ao salvar (
            {settings.company_name}).
          </p>
        </PremiumCard>
      </div>

      <ConfirmDialog
        open={pendingKind !== null}
        onOpenChange={(open) => !open && setPendingKind(null)}
        title="Descartar alterações?"
        description="Há alterações não salvas nesta roleta. Ao trocar de roleta elas serão perdidas."
        confirmLabel="Descartar e trocar"
        tone="danger"
        onConfirm={() => {
          if (pendingKind) switchKind(pendingKind)
          setPendingKind(null)
        }}
      />
    </PageFrame>
  )
}
