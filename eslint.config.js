import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/** Cores só por token (FRONTEND-ARCH §1.5/§5). Exceção: src/features/wheel/wheel-palette.ts */
const noHexLiteral = {
  selector: 'Literal[value=/^#[0-9a-fA-F]{6}$/]',
  message: 'Cor hex proibida em componente: use var(--token) ou utilitário Tailwind do tema.',
}

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/routeTree.gen.ts', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['src/features/wheel/wheel-palette.ts'],
    rules: { 'no-restricted-syntax': ['error', noHexLiteral] },
  },
  {
    // Rotas (createFileRoute), entrada do app, providers (componente + hook no mesmo arquivo) e shadcn (cva + componente)
    files: [
      'src/routes/**/*.tsx',
      'src/main.tsx',
      'src/features/**/*-provider.tsx',
      'src/components/ui/*.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Testes e helpers de teste: fixtures de cor em hex (formato do banco, DATA-MODEL §4.6) são permitidas
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'src/features/auth/test-utils.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
)
