/** "{cargo} · Nível {n}"; para admin: "Gestor · Visão da operação" (FRONTEND-ARCH §3.6). */
export const userSubtitle = (isAdmin: boolean, jobTitle: string, level: number): string =>
  isAdmin
    ? 'Gestor · Visão da operação'
    : `${jobTitle} · Nível ${Math.max(1, Math.floor(Number.isFinite(level) ? level : 1))}`
