import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/features/theme/use-theme'

type ToasterProps = React.ComponentProps<typeof Sonner>

/** Distância do rodapé: `--toast-offset` sobe para cima do bottom nav abaixo de 1024px (styles/overlays.css). */
const BOTTOM_OFFSET = 'var(--toast-offset)'
const SIDE_OFFSET = '16px'

/** Toaster global (FRONTEND-ARCH §4.7): posição inferior central, estilo `.orbion-toast` em styles/overlays.css. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()
  return (
    <Sonner
      position="bottom-center"
      richColors={false}
      theme={theme}
      closeButton={false}
      offset={{ bottom: BOTTOM_OFFSET, left: SIDE_OFFSET, right: SIDE_OFFSET }}
      mobileOffset={{ bottom: BOTTOM_OFFSET, left: SIDE_OFFSET, right: SIDE_OFFSET }}
      toastOptions={{ className: 'orbion-toast' }}
      {...props}
    />
  )
}

export { Toaster }
