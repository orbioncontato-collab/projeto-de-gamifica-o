import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/features/theme/use-theme'

type ToasterProps = React.ComponentProps<typeof Sonner>

/** Toaster global (FRONTEND-ARCH §4.7): posição inferior central, estilo `.orbion-toast` em components.css. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()
  return (
    <Sonner
      position="bottom-center"
      richColors={false}
      theme={theme}
      closeButton={false}
      toastOptions={{ className: 'orbion-toast' }}
      {...props}
    />
  )
}

export { Toaster }
