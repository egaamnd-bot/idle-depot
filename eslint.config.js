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
      // Determinism guard: core may not read clocks or use unseeded randomness.
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'Use the seeded Rng from src/core/simulation/rng.ts.' },
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: 'Core never reads a clock; time is passed in.' },
        { selector: "NewExpression[callee.name='Date']", message: 'Core never reads a clock; time is passed in.' },
        { selector: "MemberExpression[object.name='performance']", message: 'Core never reads a clock; time is passed in.' },
        { selector: "MemberExpression[object.name='crypto']", message: 'Entropy belongs to the platform adapter, not core.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'src/core must not depend on the renderer.' },
            { group: ['**/render/**', '**/ui/**', '**/platform/**', '**/persistence/**', '**/assets/**', '**/config/**', '**/app/**'], message: 'src/core must not depend on outer layers.' },
            { group: ['@telegram-apps/*', '@capacitor/*'], message: 'src/core must not depend on platform SDKs.' },
          ],
        },
      ],
    },
  },
);
