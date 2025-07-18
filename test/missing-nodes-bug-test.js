import assert from 'assert';
import { Graph } from '../index.js';

// Test case specifically designed to reproduce the missing nodes bug
// where nodes.length !== ids.length + 1

function testMissingNodesBug() {
  console.log('Testing missing nodes bug...');
  
  // Create a complex graph that will trigger node contraction
  const graph = new Graph();
  
  // Build a graph that encourages contraction:
  // Create a linear path with shortcuts that should cause some nodes to be contracted
  
  // Main path: A -> B -> C -> D -> E -> F
  graph.addEdge('A', 'B', { _id: 1, _cost: 1 });
  graph.addEdge('B', 'C', { _id: 2, _cost: 1 });
  graph.addEdge('C', 'D', { _id: 3, _cost: 1 });
  graph.addEdge('D', 'E', { _id: 4, _cost: 1 });
  graph.addEdge('E', 'F', { _id: 5, _cost: 1 });
  
  // Add some shortcuts that make intermediate nodes good candidates for contraction
  graph.addEdge('A', 'C', { _id: 6, _cost: 2.1 }); // slightly more than A->B->C
  graph.addEdge('B', 'D', { _id: 7, _cost: 2.1 }); // slightly more than B->C->D
  graph.addEdge('C', 'E', { _id: 8, _cost: 2.1 }); // slightly more than C->D->E
  graph.addEdge('D', 'F', { _id: 9, _cost: 2.1 }); // slightly more than D->E->F
  
  // Add some additional nodes to make the graph more complex
  graph.addEdge('A', 'G', { _id: 10, _cost: 5 });
  graph.addEdge('G', 'F', { _id: 11, _cost: 5 });
  graph.addEdge('B', 'H', { _id: 12, _cost: 3 });
  graph.addEdge('H', 'E', { _id: 13, _cost: 3 });
  
  console.log('Graph created with', Object.keys(graph._nodeToIndexLookup).length, 'nodes');
  
  // Contract the graph - this should cause some nodes to be contracted
  graph.contractGraph();
  
  console.log('Graph contracted');
  
  // Test pathfinding with nodes option
  const finder = graph.createPathfinder({ ids: true, nodes: true });
  const result = finder.queryContractionHierarchy('A', 'F');
  
  console.log('Query result:');
  console.log('  Total cost:', result.total_cost);
  console.log('  IDs:', result.ids);
  console.log('  IDs length:', result.ids ? result.ids.length : 0);
  console.log('  Nodes:', result.nodes);
  console.log('  Nodes length:', result.nodes ? result.nodes.length : 0);
  
  if (result.ids && result.nodes) {
    const expectedNodesLength = result.ids.length + 1;
    console.log('  Expected nodes length (ids.length + 1):', expectedNodesLength);
    console.log('  Actual nodes length:', result.nodes.length);
    console.log('  Assumption holds (nodes.length === ids.length + 1):', result.nodes.length === expectedNodesLength);
    
    if (result.nodes.length !== expectedNodesLength) {
      console.log('  *** BUG REPRODUCED: Missing nodes detected! ***');
      console.log('  Missing', expectedNodesLength - result.nodes.length, 'nodes');
      
      // Try to identify which nodes are missing by analyzing edges
      console.log('  Analysis of edges:');
      if (result.ids.length > 0) {
        // We'd need access to edge properties to fully analyze this
        console.log('  To fully analyze missing nodes, we need access to edge start/end data');
      }
      
      return {
        bugReproduced: true,
        expectedNodes: expectedNodesLength,
        actualNodes: result.nodes.length,
        missingCount: expectedNodesLength - result.nodes.length
      };
    } else {
      console.log('  No bug detected in this test case');
      return {
        bugReproduced: false,
        expectedNodes: expectedNodesLength,
        actualNodes: result.nodes.length,
        missingCount: 0
      };
    }
  } else {
    console.log('  No path found or no nodes/ids returned');
    return { bugReproduced: false, reason: 'No path found' };
  }
}

// Test with different graph configurations to increase chances of reproducing the bug
function testMultipleConfigurations() {
  console.log('\n=== Testing Multiple Graph Configurations ===\n');
  
  const configs = [
    {
      name: 'Linear path with shortcuts',
      test: testMissingNodesBug
    },
    {
      name: 'Star configuration',
      test: testStarConfiguration
    },
    {
      name: 'Grid-like pattern',
      test: testGridPattern
    }
  ];
  
  let totalBugsFound = 0;
  
  configs.forEach((config, index) => {
    console.log(`\n--- Test ${index + 1}: ${config.name} ---`);
    const result = config.test();
    if (result.bugReproduced) {
      totalBugsFound++;
      console.log(`✗ Bug reproduced in ${config.name}`);
    } else {
      console.log(`✓ No bug in ${config.name}`);
    }
  });
  
  console.log(`\n=== Summary ===`);
  console.log(`Total configurations tested: ${configs.length}`);
  console.log(`Bugs reproduced: ${totalBugsFound}`);
  
  if (totalBugsFound > 0) {
    console.log('\n*** THE MISSING NODES BUG HAS BEEN REPRODUCED ***');
    return true;
  } else {
    console.log('\nNo bugs reproduced. May need more complex test cases.');
    return false;
  }
}

function testStarConfiguration() {
  const graph = new Graph();
  
  // Create a star pattern - one central node connected to many others
  graph.addEdge('CENTER', 'A', { _id: 1, _cost: 1 });
  graph.addEdge('CENTER', 'B', { _id: 2, _cost: 1 });
  graph.addEdge('CENTER', 'C', { _id: 3, _cost: 1 });
  graph.addEdge('CENTER', 'D', { _id: 4, _cost: 1 });
  graph.addEdge('CENTER', 'E', { _id: 5, _cost: 1 });
  
  // Add connections between outer nodes
  graph.addEdge('A', 'B', { _id: 6, _cost: 1.5 });
  graph.addEdge('B', 'C', { _id: 7, _cost: 1.5 });
  graph.addEdge('C', 'D', { _id: 8, _cost: 1.5 });
  graph.addEdge('D', 'E', { _id: 9, _cost: 1.5 });
  graph.addEdge('E', 'A', { _id: 10, _cost: 1.5 });
  
  graph.contractGraph();
  
  const finder = graph.createPathfinder({ ids: true, nodes: true });
  const result = finder.queryContractionHierarchy('A', 'D');
  
  if (result.ids && result.nodes) {
    const expectedNodesLength = result.ids.length + 1;
    return {
      bugReproduced: result.nodes.length !== expectedNodesLength,
      expectedNodes: expectedNodesLength,
      actualNodes: result.nodes.length,
      missingCount: Math.max(0, expectedNodesLength - result.nodes.length)
    };
  }
  
  return { bugReproduced: false, reason: 'No path found' };
}

function testGridPattern() {
  const graph = new Graph();
  
  // Create a 3x3 grid pattern
  // Row 1: A1 - A2 - A3
  // Row 2: B1 - B2 - B3  
  // Row 3: C1 - C2 - C3
  // With vertical connections
  
  // Horizontal connections
  graph.addEdge('A1', 'A2', { _id: 1, _cost: 1 });
  graph.addEdge('A2', 'A3', { _id: 2, _cost: 1 });
  graph.addEdge('B1', 'B2', { _id: 3, _cost: 1 });
  graph.addEdge('B2', 'B3', { _id: 4, _cost: 1 });
  graph.addEdge('C1', 'C2', { _id: 5, _cost: 1 });
  graph.addEdge('C2', 'C3', { _id: 6, _cost: 1 });
  
  // Vertical connections
  graph.addEdge('A1', 'B1', { _id: 7, _cost: 1 });
  graph.addEdge('B1', 'C1', { _id: 8, _cost: 1 });
  graph.addEdge('A2', 'B2', { _id: 9, _cost: 1 });
  graph.addEdge('B2', 'C2', { _id: 10, _cost: 1 });
  graph.addEdge('A3', 'B3', { _id: 11, _cost: 1 });
  graph.addEdge('B3', 'C3', { _id: 12, _cost: 1 });
  
  // Add some diagonal shortcuts
  graph.addEdge('A1', 'B2', { _id: 13, _cost: 1.4 });
  graph.addEdge('B2', 'C3', { _id: 14, _cost: 1.4 });
  graph.addEdge('A2', 'C1', { _id: 15, _cost: 2.2 });
  
  graph.contractGraph();
  
  const finder = graph.createPathfinder({ ids: true, nodes: true });
  const result = finder.queryContractionHierarchy('A1', 'C3');
  
  if (result.ids && result.nodes) {
    const expectedNodesLength = result.ids.length + 1;
    return {
      bugReproduced: result.nodes.length !== expectedNodesLength,
      expectedNodes: expectedNodesLength,
      actualNodes: result.nodes.length,
      missingCount: Math.max(0, expectedNodesLength - result.nodes.length)
    };
  }
  
  return { bugReproduced: false, reason: 'No path found' };
}

// Run the tests
const bugFound = testMultipleConfigurations();

if (bugFound) {
  process.exit(1); // Exit with error code to indicate bug found
} else {
  console.log('\nAll tests passed - no missing nodes bug detected');
  process.exit(0);
}