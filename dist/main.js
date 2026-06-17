// Runtime entry point — uses tsx to execute TypeScript source directly.
// This avoids tsc compilation on deployment environments that can't resolve @types.
require('tsx/cjs');
require('../src/main.ts');
