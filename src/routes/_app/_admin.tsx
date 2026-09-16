import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/** Layout pathless do gestor (FRONTEND-ARCH §3.4): só `role === 'admin'`; o banco nega o resto de qualquer forma. */
export const Route = createFileRoute('/_app/_admin')({
  beforeLoad: ({ context }) => {
    if (context.bootstrap.me.status !== 'active' || context.bootstrap.me.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  component: Outlet,
})
