import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Remora rule: one icon per concept, all icons through src/ui/icons.ts.
      'no-restricted-imports': ['error', { paths: [{ name: 'lucide-react', message: 'Import icons from src/ui/icons.ts.' }] }],
    },
  },
  { files: ['src/ui/icons.ts'], rules: { 'no-restricted-imports': 'off' } },
)
