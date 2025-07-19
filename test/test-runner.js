import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.currentSuite = null;
  }

  async describe(suiteName, fn) {
    this.currentSuite = suiteName;
    console.log(`\n📋 ${suiteName}`);
    await fn();
    this.currentSuite = null;
  }

  async it(testName, fn) {
    try {
      await fn();
      this.passed++;
      console.log(`  ✅ ${testName}`);
    } catch (error) {
      this.failed++;
      console.log(`  ❌ ${testName}`);
      console.log(`     Error: ${error.message}`);
      if (error.stack) {
        console.log(`     Stack: ${error.stack.split('\n')[1]?.trim()}`);
      }
    }
  }

  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message = 'Values are not equal') {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
    }
  }

  assertDeepEqual(actual, expected, message = 'Objects are not deeply equal') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
    }
  }

  assertThrows(fn, expectedError, message = 'Function should throw') {
    try {
      fn();
      throw new Error(message);
    } catch (error) {
      if (expectedError && !error.message.includes(expectedError)) {
        throw new Error(`Expected error containing "${expectedError}", got: ${error.message}`);
      }
    }
  }

  summary() {
    console.log(`\n📊 Test Summary:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Total: ${this.passed + this.failed}`);
    
    if (this.failed > 0) {
      console.log(`\n💥 Some tests failed!`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All tests passed!`);
    }
  }
}

// Create global test runner instance
const runner = new TestRunner();

// Export functions to global scope for test files
global.describe = runner.describe.bind(runner);
global.it = runner.it.bind(runner);
global.assert = runner.assert.bind(runner);
global.assertEqual = runner.assertEqual.bind(runner);
global.assertDeepEqual = runner.assertDeepEqual.bind(runner);
global.assertThrows = runner.assertThrows.bind(runner);

export default runner;