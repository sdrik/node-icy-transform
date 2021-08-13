/* vim: set ts=2 sts=2 sw=2 et: */

module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json',
    },
  },
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/test/**/*.test.(ts|js)'],
  testEnvironment: 'node',
}
