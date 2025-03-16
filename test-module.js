// Simple JavaScript module for testing module loading
export const testMessage = 'Module loaded successfully!';

export function testFunction() {
  return 'This function was executed from a correctly loaded ES module';
}

export default {
  name: 'TestModule',
  version: '1.0.0',
  testFunction
}; 