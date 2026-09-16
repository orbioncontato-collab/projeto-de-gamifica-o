import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/profile/components/profile-page'

/** /perfil — `ProfilePage` (WP2). */
export const Route = createFileRoute('/_app/perfil')({ component: ProfilePage })
