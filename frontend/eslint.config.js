import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const layers = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'];

// A slice is reached only through its index.ts, and a layer imports only the layers below it.
function importRules(layer) {
  const higher = layers.slice(layers.indexOf(layer) + 1);
  return {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['@/*/*/*'], message: 'Импорт только через index.ts слайса.' },
          { group: ['../../*'], message: 'Импорт из другого слайса только через алиас @/.' },
          ...higher.map((upper) => ({
            group: [`@/${upper}`, `@/${upper}/*`],
            message: `Слой ${layer} не импортирует слой ${upper}.`,
          })),
        ],
      },
    ],
  };
}

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: { allowDefaultProject: ['eslint.config.js'] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML запрещён.' },
        { selector: "MemberExpression[property.name='innerHTML']", message: 'innerHTML запрещён.' },
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='open']",
          message: 'window.open только через openExternal.',
        },
      ],
    },
  },
  ...layers.map((layer) => ({ files: [`src/${layer}/**/*.{ts,tsx}`], rules: importRules(layer) })),
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
);
