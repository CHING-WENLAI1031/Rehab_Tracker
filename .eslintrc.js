module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'airbnb-base',
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Customize rules for Node.js backend
    'no-console': 'off', // Allow console.log in backend
    'consistent-return': 'off', // Allow different return patterns
    'func-names': 'off', // Allow anonymous functions
    'object-shorthand': 'off', // Allow both object formats
    'no-process-exit': 'off', // Allow process.exit() in Node.js
    'no-param-reassign': ['error', { 'props': false }], // Allow parameter property modification
    'no-underscore-dangle': ['error', { 'allow': ['_id'] }], // Allow _id for MongoDB
    'max-len': ['error', {
      'code': 100,
      'ignoreUrls': true,
      'ignoreStrings': true,
      'ignoreTemplateLiterals': true
    }],
    'comma-dangle': ['error', 'never'], // No trailing commas
    'quotes': ['error', 'single'], // Single quotes
    'semi': ['error', 'always'], // Require semicolons
    'indent': ['error', 2], // 2-space indentation
    'no-trailing-spaces': 'error', // No trailing spaces
    'eol-last': 'error', // Require newline at end of file

    // Import rules
    'import/no-dynamic-require': 'off', // Allow dynamic require
    'import/no-extraneous-dependencies': ['error', {
      'devDependencies': ['**/*.test.js', '**/*.spec.js', '**/test/**/*']
    }],

    // Node.js specific
    'global-require': 'off', // Allow require() anywhere
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always'
    }]
  },
  ignorePatterns: [
    'node_modules/',
    'output/',
    'dist/',
    'build/'
  ]
};