const { Graph } = require('./index.js');

// Create a test case that might reproduce the issue
function testMissingNodes() {
  const graph = new Graph();
  
  // Create a more complex graph that might trigger contraction
  graph.addEdge('A', 'B', { _id: 1, _cost: 1 });
  graph.addEdge('B', 'C', { _id: 2, _cost: 1 });
  graph.addEdge('C', 'D', { _id: 3, _cost: 1 });
  graph.addEdge('D', 'E', { _id: 4, _cost: 1 });
  graph.addEdge('E', 'F', { _id: 5, _cost: 1 });
  
  // Add some alternate paths to make contraction more likely
  graph.addEdge('A', 'C', { _id: 6, _cost: 3 });
  graph.addEdge('B', 'D', { _id: 7, _cost: 3 });
  graph.addEdge('C', 'E', { _id: 8, _cost: 3 });
  graph.addEdge('D', 'F', { _id: 9, _cost: 3 });
  
  graph.contractGraph();
  
  const finder = graph.createPathfinder({ ids: true, nodes: true });
  const result = finder.queryContractionHierarchy('A', 'F');
  
  console.log('Result:', result);
  console.log('IDs length:', result.ids.length);
  console.log('Nodes length:', result.nodes.length);
  console.log('Expected nodes length (ids.length + 1):', result.ids.length + 1);
  console.log('Assumption holds:', result.nodes.length === result.ids.length + 1);
  
  // Try to reconstruct nodes from edges to see if we can find missing ones
  const edgesNodes = new Set();
  if (result.ids && result.ids.length > 0) {
    // We'd need access to internal edge data to fully test this
    console.log('To fully test this, we would need to check the edges for their start/end nodes');
  }
  
  return result;
}

console.log('Testing missing nodes issue...');
testMissingNodes();