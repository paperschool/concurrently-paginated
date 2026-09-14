const globals = require("globals");

module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: "commonjs",
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "error",
      "prefer-const": "error",
    },
  },
];