import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Brand } from './brand'
import { SidebarContent } from './sidebar-content'

export interface MobileDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Drawer (`Sheet`) com a mesma navegação da sidebar; fecha ao navegar (Definition of Done WP1). */
export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[280px] flex-col p-0">
        <SheetHeader className="px-4 pb-1 pt-5 text-left">
          <Brand />
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação do app</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <SidebarContent hideBrand onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
