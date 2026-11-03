import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'android'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Architecture rule: the simulation core must stay platform- and renderer-agnostic.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'src/core must not depend on the renderer.' },
            { group: ['**/render/**', '**/ui/**', '**/platform/**', '**/persistence/**', '**/assets/**'], message: 'src/core must not depend on outer layers.' },
            { group: ['@telegram-apps/*', '@capacitor/*'], message: 'src/core must not depend on platform SDKs.' },
          ],
        },
      ],
    },
  },
);
