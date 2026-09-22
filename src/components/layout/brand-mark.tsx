import type { SVGProps } from 'react'

/**
 * Símbolo padrão do Sales League — "Escudo Ascendente" (fonte: _src/logo/mark.svg):
 * escudo cujo topo sobe em três degraus de ranking. `currentColor`, legível em 16 px.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M6 34H20V25H34V16H48V7H58V40C58 51 47 59 32 63C17 59 6 51 6 40V34ZM20 25H24V43L30 49V25H20ZM34 16H38V49L44 43V16H34Z"
      />
    </svg>
  )
}
