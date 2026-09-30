import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: [
      'components/AmiAuditWorkspace.tsx',
      'components/AnnualUnitPlanEditor.tsx',
    ],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default config;
