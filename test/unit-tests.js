const assert = require('assert');

const Graph = require('../index.js').Graph;
const graph = new Graph();

// start_node, end_node, edge_properties, edge_geometry
graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
graph.contractGraph();
const finder = graph.createPathfinder({ ids: true, path: false });
const ids = finder.queryContractionHierarchy('A', 'C');

console.log('new adj')
console.log(graph.adjacency_list)
console.log('new rev')
console.log(graph.reverse_adjacency_list)

console.log(graph)
console.log(ids)
assert(5 > 7);
