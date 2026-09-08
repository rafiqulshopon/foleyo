import '@testing-library/jest-dom/vitest';

// jsdom does not implement object URL APIs — stub them for subtitle/blob tests
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:mock-${Math.random().toString(36).slice(2)}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
