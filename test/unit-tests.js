const assert = require('assert');

const Graph = require('../index.js').Graph;
const graph = new Graph();

// start_node, end_node, edge_properties, edge_geometry
graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
graph.contractGraph();
const finder = graph.createPathfinder({ ids: true, path: false });
const result = finder.queryContractionHierarchy('A', 'C');

console.log(graph)
console.log(result)
assert(result.total_cost === 3);
assert.deepEqual(result.ids, [100, 101]);
