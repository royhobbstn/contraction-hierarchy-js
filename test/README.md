# Test Suite Documentation

This directory contains a comprehensive test suite for contraction-hierarchy-js with organized test categories and easy-to-use npm scripts.

## Test Categories

### 🧪 API Examples Tests (`npm run test:api`)
**File:** `api-examples.test.js`

Tests all the API examples shown in the main README.md to ensure documentation stays current and examples work correctly.

**Covers:**
- Basic GeoJSON workflow with CoordinateLookup
- Manual API for non-GeoJSON data  
- Graph constructor options (debug mode)
- addEdge with different parameters
- createPathfinder output options
- queryContractionHierarchy input types
- CoordinateLookup functionality
- JSON serialization (saveCH/loadCH)
- Protocol Buffer serialization (savePbfCH/loadPbfCH)
- Directed vs undirected networks
- Edge properties preservation

### 🔄 Regression Tests (`npm run test:regression`)
**File:** `regression.test.js`

Tests core functionality and prevents regressions by covering the basic pathfinding scenarios.

**Covers:**
- Simple directed graph pathfinding
- No path scenarios in directed graphs
- Basic undirected graph operations
- Reverse path testing
- GeoJSON coordinate-based pathfinding
- Empty graph handling
- Single node queries

### ⚡ Performance Tests (`npm run test:performance`)
**File:** `performance.test.js`

Tests performance characteristics and memory usage patterns.

**Covers:**
- Large manual graph performance
- GeoJSON network performance
- Memory usage patterns
- Query time benchmarks
- Contraction time benchmarks

### 🏛️ Legacy Tests (`npm run test:legacy`)
**File:** `routing-tests.js` (original)

The original test suite, preserved for compatibility.

## Available npm Scripts

```bash
# Run all test categories
npm run test:all

# Run specific test categories
npm run test:api          # API examples from README
npm run test:regression   # Core functionality tests
npm run test:performance  # Performance benchmarks
npm run test:legacy       # Original test suite

# Watch for changes (requires 'entr' tool)
npm run test:watch

# Default test (legacy compatibility)
npm test
```

## Test Framework

The test suite uses a custom lightweight test runner (`test-runner.js`) that provides:

- **Organized test suites** with `describe()` and `it()`
- **Assertion helpers**: `assert()`, `assertEqual()`, `assertDeepEqual()`, `assertThrows()`
- **Clear output** with ✅/❌ indicators and test summaries
- **Error reporting** with helpful messages and stack traces

## Writing New Tests

### Basic Test Structure

```javascript
import runner from './test-runner.js';
import { Graph, CoordinateLookup } from '../index.js';

describe('My Test Suite', () => {
  
  it('should do something', () => {
    const graph = new Graph();
    graph.addEdge('A', 'B', { _id: 1, _cost: 5 });
    graph.contractGraph();
    
    const finder = graph.createPathfinder();
    const result = finder.queryContractionHierarchy('A', 'B');
    
    assertEqual(result.total_cost, 5);
  });
  
});

// Don't forget to call summary at the end
runner.summary();
```

### Assertion Methods

```javascript
// Basic assertion
assert(condition, 'Optional error message');

// Value equality
assertEqual(actual, expected, 'Optional error message');

// Deep object equality  
assertDeepEqual(actualObject, expectedObject, 'Optional error message');

// Exception testing
assertThrows(() => {
  // Code that should throw
}, 'Expected error text', 'Optional error message');
```

## Performance Testing Guidelines

When writing performance tests:

1. **Use reasonable thresholds** - not too strict to avoid flaky tests
2. **Include timing information** in console output for debugging
3. **Test memory growth** for long-running operations
4. **Use representative data sizes** for realistic performance metrics

## Test Data

The test suite includes shared test data:

- **`basicGeojson`** - A simple 4-edge linear network for basic testing
- **Grid networks** - Generated programmatically for performance testing
- **Manual graphs** - Simple node/edge structures for unit testing

## Running Tests in CI/CD

For continuous integration, use:

```bash
npm run test:all
```

This runs all test categories and exits with status code 1 if any tests fail.

## Troubleshooting

### Common Issues

1. **PBF serialization tests failing**: Known ES module compatibility issue with `require()` usage
2. **Performance tests too slow**: May need to adjust thresholds for slower machines
3. **Memory tests failing**: Node.js garbage collection timing can affect results

### Debugging Tests

Add console output in tests for debugging:

```javascript
it('debug test', () => {
  const result = someOperation();
  console.log('      Debug info:', result);
  assertEqual(result.value, expectedValue);
});
```

The test runner will display debug output indented under the test name.