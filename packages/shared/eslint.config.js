const tseslint = require('typescript-eslint');

/**
 * ESLint for `@sonora/shared`: the contract every app consumes, and until now the one
 * workspace no `make lint` target reached.
 *
 * It applies the same typed rules the API uses, because most of this package is read
 * from there: a silent `any`, an unused export or a widened interface should fail here
 * rather than in a consumer that cannot fix it.
 */
module.exports = tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // `const { field, ...rest }` is how a test omits a key on purpose: the
          // destructured sibling is unused by design, not forgotten.
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tests are fixtures: they build partial objects on purpose.
    files: ['src/__tests__/**', 'src/**/__tests__/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/*', 'coverage/*'],
  },
);
