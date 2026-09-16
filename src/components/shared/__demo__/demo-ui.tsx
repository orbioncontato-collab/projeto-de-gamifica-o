import { useState } from 'react'
import { Bell, ChevronDown, Info, Plus, Search } from 'lucide-react'
import { notify } from '@/lib/notify'
import { ThemeSwitch } from '@/features/theme/theme-switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Demo } from './demo-block'

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'gold', 'blue', 'link'] as const

/** Primitivos de `components/ui` (11 mantidos) + ThemeSwitch, para validar foco, contraste e toque nos dois temas. */
export function UiDemos() {
  const [checked, setChecked] = useState(true)
  const [on, setOn] = useState(false)

  return (
    <div className="space-y-8">
      <Demo title="Button (variantes)">
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button loading>Salvando</Button>
        <Button disabled>Desabilitado</Button>
      </Demo>

      <Demo title="Button (tamanhos e só-ícone com aria-label)">
        <Button size="sm">Pequeno</Button>
        <Button size="md">Médio</Button>
        <Button size="lg">Grande</Button>
        <Button size="icon" variant="secondary" aria-label="Notificações">
          <Bell />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Adicionar">
          <Plus />
        </Button>
      </Demo>

      <Demo title="Input / Textarea / Select">
        <div className="w-full max-w-64 space-y-1">
          <Label htmlFor="demo-search">Buscar colaborador</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input id="demo-search" placeholder="Nome ou e-mail" className="pl-9" />
          </div>
        </div>
        <div className="w-full max-w-64 space-y-1">
          <Label htmlFor="demo-select">Métrica</Label>
          <Select defaultValue="sales">
            <SelectTrigger id="demo-select" aria-label="Métrica">
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Vendas</SelectItem>
              <SelectItem value="meetings">Reuniões</SelectItem>
              <SelectItem value="calls">Ligações</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-64 space-y-1">
          <Label htmlFor="demo-disabled">Desabilitado</Label>
          <Input id="demo-disabled" value="Trava após o primeiro lançamento" disabled readOnly />
        </div>
      </Demo>

      <Demo title="Checkbox / Switch">
        <div className="flex items-center gap-2">
          <Checkbox id="demo-check" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          <Label htmlFor="demo-check" className="mb-0">
            Participa do ranking
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="demo-switch" checked={on} onCheckedChange={setOn} />
          <Label htmlFor="demo-switch" className="mb-0">
            Aprovar novos membros automaticamente
          </Label>
        </div>
      </Demo>

      <Demo title="Tabs (rola em telas estreitas)" stack>
        <Tabs defaultValue="rules">
          <TabsList aria-label="Seções de pontuação">
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="launch">Lançar</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          <TabsContent value="rules" className="text-sm text-muted">
            Conteúdo da aba Regras.
          </TabsContent>
          <TabsContent value="launch" className="text-sm text-muted">
            Conteúdo da aba Lançar.
          </TabsContent>
          <TabsContent value="history" className="text-sm text-muted">
            Conteúdo da aba Histórico.
          </TabsContent>
          <TabsContent value="manual" className="text-sm text-muted">
            Conteúdo da aba Manual.
          </TabsContent>
        </Tabs>
      </Demo>

      <Demo title="Tooltip / DropdownMenu">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Mais informações">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Começa em 01/10</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              Menu do usuário
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Conta</DropdownMenuLabel>
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <DropdownMenuItem>Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Demo>

      <Demo title="Dialog / Sheet (foco preso, Esc fecha)">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Abrir modal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Título do modal</DialogTitle>
              <DialogDescription>
                O foco fica preso aqui; Tab circula pelos controles e Esc fecha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="demo-dialog-input">Campo de exemplo</Label>
              <Input id="demo-dialog-input" placeholder="Digite algo" />
            </div>
            <DialogFooter>
              <Button variant="secondary">Cancelar</Button>
              <Button>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Abrir drawer</Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-5">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Drawer lateral (mobile).</SheetDescription>
            </SheetHeader>
            <nav className="mt-4 space-y-1" aria-label="Exemplo">
              <a className="nav-item" href="#topo">
                Visão geral
              </a>
              <a className="nav-item" data-status="active" href="#topo">
                Ranking
              </a>
            </nav>
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Sheet inferior</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-5">
            <SheetHeader>
              <SheetTitle>Ações</SheetTitle>
              <SheetDescription>Sheet inferior com área segura do iPhone.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Demo>

      <Demo title="Toast (acima do bottom nav no mobile)">
        <Button
          variant="secondary"
          onClick={() => notify.success('Lançamento salvo', '100 pontos para a regra Venda fechada')}
        >
          Sucesso
        </Button>
        <Button variant="secondary" onClick={() => notify.error(new Error('SEASON_NOT_ACTIVE'))}>
          Erro
        </Button>
        <Button variant="secondary" onClick={() => notify.warning('Estoque baixo', 'Restam 2 unidades')}>
          Aviso
        </Button>
      </Demo>

      <Demo title="Separator / Skeleton / ThemeSwitch">
        <div className="w-full max-w-64 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Separator />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <ThemeSwitch />
        <ThemeSwitch compact />
      </Demo>
    </div>
  )
}
