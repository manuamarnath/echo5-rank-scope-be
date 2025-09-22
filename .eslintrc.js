module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  extends: 'airbnb-base',
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-console': 'off', // Allow console for server logging
    'comma-dangle': ['error', 'only-multiline'],
    'no-underscore-dangle': ['error', { allow: ['_id'] }], // Allow _id for MongoDB
    'max-len': ['error', { code: 120 }], // Increase line length limit
    'no-param-reassign': ['error', { props: false }], // Allow parameter property reassignment
    'consistent-return': 'off', // Allow functions without return
    'no-unused-vars': ['error', { argsIgnorePattern: 'next' }], // Ignore unused next parameter
    'linebreak-style': 'off', // Disable linebreak style to work across different OS
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }], // Allow dev dependencies
    'arrow-body-style': 'off', // Allow flexibility in arrow function body style
    'import/order': ['error', { 'newlines-between': 'always' }], // Fix import order issues
    radix: ['error', 'always'], // Require radix parameter for parseInt
    'no-trailing-spaces': 'error', // Disallow trailing spaces
    'eol-last': ['error', 'always'], // Require newline at end of files
    'no-await-in-loop': 'off', // Allow await in loops for sequential processing
    'no-continue': 'off', // Allow continue statements
    // Relax function naming and shorthand enforcement for backend files. These
    // strict rules cause 'Unexpected unnamed method' and similar errors when
    // using object properties or callback functions in older JS patterns.
    'func-names': 'off',
    'object-shorthand': 'off',
    'prefer-arrow-callback': 'off'
  },
};
