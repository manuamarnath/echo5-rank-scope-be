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
  },
};