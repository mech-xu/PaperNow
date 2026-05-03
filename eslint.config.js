import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx,vue}'],
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off',  // TypeScript handles this, avoids false positives with uni globals
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/no-undef-components': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.output/', '*.d.ts', 'src/types/database.ts'],
  },
)
