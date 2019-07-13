const assert = require('assert');

// simple directed graph, start to end
(function() {
  const Graph = require('../index.js').Graph;
  const graph = new Graph();

  // start_node, end_node, edge_properties, edge_geometry
  graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
  graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
  graph.contractGraph();
  const finder = graph.createPathfinder({ ids: true, path: false });
  const result = finder.queryContractionHierarchy('A', 'C');

  assert(result.total_cost === 3);
  assert.deepEqual(result.ids, [100, 101]);
}());

// simple directed graph, end to start: No Path
(function() {
  const Graph = require('../index.js').Graph;
  const graph = new Graph();

  // start_node, end_node, edge_properties, edge_geometry
  graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
  graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
  graph.contractGraph();
  const finder = graph.createPathfinder({ ids: true, path: false });
  const result = finder.queryContractionHierarchy('C', 'A');

  assert(result.total_cost === 0);
  assert.deepEqual(result.ids, []);
}());


// undirected graph, forward path
(function() {
  const Graph = require('../index.js').Graph;
  const graph = new Graph();

  // start_node, end_node, edge_properties, edge_geometry
  graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
  graph.addEdge('B', 'A', { _id: 200, _cost: 1 });

  graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
  graph.addEdge('C', 'B', { _id: 201, _cost: 2 });

  graph.addEdge('C', 'D', { _id: 102, _cost: 5 });
  graph.addEdge('D', 'C', { _id: 202, _cost: 5 });

  graph.contractGraph();
  const finder = graph.createPathfinder({ ids: true, path: false });
  const result = finder.queryContractionHierarchy('A', 'D');

  assert(result.total_cost === 8);
  assert.deepEqual(result.ids, [100, 101, 102]);
}());


// undirected graph, backward path
(function() {
  const Graph = require('../index.js').Graph;
  const graph = new Graph();

  // start_node, end_node, edge_properties, edge_geometry
  graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
  graph.addEdge('B', 'A', { _id: 200, _cost: 1 });

  graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
  graph.addEdge('C', 'B', { _id: 201, _cost: 2 });

  graph.addEdge('C', 'D', { _id: 102, _cost: 5 });
  graph.addEdge('D', 'C', { _id: 202, _cost: 5 });

  graph.contractGraph();
  const finder = graph.createPathfinder({ ids: true, path: false });
  const result = finder.queryContractionHierarchy('D', 'A');

  assert(result.total_cost === 8);
  assert.deepEqual(result.ids, [202, 201, 200]);
}());


// geojson


// undirected graph, forward path, geojson
(function() {
  const fs = require('fs');
  const geojson = JSON.parse(fs.readFileSync('../networks/basic.geojson'));
  const Graph = require('../index.js').Graph;
  const graph = new Graph(geojson);

  graph.contractGraph();
  const finder = graph.createPathfinder({ ids: true, path: true });
  const result = finder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);

  assert(result.total_cost === 22);
  assert.deepEqual(result.ids, [1, 2, 3, 4]);
  assert.deepEqual(result.path, {
    "type": "FeatureCollection",
    "features": [{
      "type": "Feature",
      "properties": { "_id": 1, "_cost": 1, "_start_index": 0, "_end_index": 1, "_ordered": [0] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-116.452899, 41.967659],
          [-113.330402, 43.245203]
        ]
      }
    }, {
      "type": "Feature",
      "properties": { "_id": 2, "_cost": 3, "_start_index": 1, "_end_index": 2, "_ordered": [2] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-113.330402, 43.245203],
          [-109.306339, 42.244785]
        ]
      }
    }, {
      "type": "Feature",
      "properties": { "_id": 3, "_cost": 7, "_start_index": 2, "_end_index": 3, "_ordered": [4] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-109.306339, 42.244785],
          [-113.132497, 41.902277]
        ]
      }
    }, {
      "type": "Feature",
      "properties": { "_id": 4, "_cost": 11, "_start_index": 3, "_end_index": 4, "_ordered": [6] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-113.132497, 41.902277],
          [-117.452899, 40.967659]
        ]
      }
    }]
  });
}());

// undirected graph, backward path, geojson
(function() {
  const fs = require('fs');
  const geojson = JSON.parse(fs.readFileSync('../networks/basic.geojson'));
  const Graph = require('../index.js').Graph;
  const graph = new Graph(geojson);

  graph.contractGraph();
  const finder = graph.createPathfinder({ ids: true, path: true });
  const result = finder.queryContractionHierarchy([-117.452899, 40.967659], [-116.452899, 41.967659]);

  assert(result.total_cost === 22);
  assert.deepEqual(result.ids, [4, 3, 2, 1]);
  assert.deepEqual(result.path, {
    "type": "FeatureCollection",
    "features": [{
      "type": "Feature",
      "properties": { "_id": 4, "_cost": 11, "_start_index": 4, "_end_index": 3, "_ordered": [7] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-117.452899, 40.967659],
          [-113.132497, 41.902277]
        ]
      }
    }, {
      "type": "Feature",
      "properties": { "_id": 3, "_cost": 7, "_start_index": 3, "_end_index": 2, "_ordered": [5] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-113.132497, 41.902277],
          [-109.306339, 42.244785]
        ]
      }
    }, {
      "type": "Feature",
      "properties": { "_id": 2, "_cost": 3, "_start_index": 2, "_end_index": 1, "_ordered": [3] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-109.306339, 42.244785],
          [-113.330402, 43.245203]
        ]
      }
    }, {
      "type": "Feature",
      "properties": { "_id": 1, "_cost": 1, "_start_index": 1, "_end_index": 0, "_ordered": [1] },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-113.330402, 43.245203],
          [-116.452899, 41.967659]
        ]
      }
    }]
  });
}());

console.log('Done.');
