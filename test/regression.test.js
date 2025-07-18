import runner from './test-runner.js';
import { Graph } from '../index.js';

describe('Regression Tests', () => {

  it('Simple directed graph pathfinding', () => {
    // From original routing-tests.js
    const graph = new Graph();
    graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
    graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
    graph.contractGraph();
    const finder = graph.createPathfinder({ ids: true });
    const result = finder.queryContractionHierarchy('A', 'C');

    assertEqual(result.total_cost, 3);
    assertDeepEqual(result.ids, [100, 101]);
  });

  it('No path available in directed graph', () => {
    // From original routing-tests.js
    const graph = new Graph();
    graph.addEdge('A', 'B', { _id: 100, _cost: 1 });
    graph.addEdge('B', 'C', { _id: 101, _cost: 2 });
    graph.contractGraph();
    const finder = graph.createPathfinder({ ids: true });
    const result = finder.queryContractionHierarchy('C', 'A');

    assertEqual(result.total_cost, 0);
    assertDeepEqual(result.ids, []);
  });

  it('Basic undirected graph', () => {
    // From original routing-tests.js
    const graph = new Graph();
    graph.addEdge('A', 'B', { _id: 1, _cost: 1 }, null, true);
    graph.addEdge('B', 'C', { _id: 2, _cost: 2 }, null, true);
    graph.addEdge('C', 'D', { _id: 3, _cost: 3 }, null, true);
    graph.contractGraph();
    const finder = graph.createPathfinder({ ids: true });
    const result = finder.queryContractionHierarchy('A', 'D');

    assertEqual(result.total_cost, 6);
    assertDeepEqual(result.ids, [1, 2, 3]);
  });

  it('Reverse path in undirected graph', () => {
    // From original routing-tests.js
    const graph = new Graph();
    graph.addEdge('A', 'B', { _id: 1, _cost: 1 }, null, true);
    graph.addEdge('B', 'C', { _id: 2, _cost: 2 }, null, true);
    graph.addEdge('C', 'D', { _id: 3, _cost: 3 }, null, true);
    graph.contractGraph();
    const finder = graph.createPathfinder({ ids: true });
    const result = finder.queryContractionHierarchy('D', 'A');

    assertEqual(result.total_cost, 6);
    assertDeepEqual(result.ids, [3, 2, 1]);
  });

  it('GeoJSON coordinate-based pathfinding', () => {
    // From original routing-tests.js
    const geojson = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": { "_id": 1, "_cost": 1 },
          "geometry": {
            "type": "LineString",
            "coordinates": [[-116.452899, 41.967659], [-113.330402, 43.245203]]
          }
        },
        {
          "type": "Feature", 
          "properties": { "_id": 2, "_cost": 3 },
          "geometry": {
            "type": "LineString",
            "coordinates": [[-113.330402, 43.245203], [-109.306339, 42.244785]]
          }
        },
        {
          "type": "Feature",
          "properties": { "_id": 3, "_cost": 7 },
          "geometry": {
            "type": "LineString", 
            "coordinates": [[-109.306339, 42.244785], [-113.132497, 41.902277]]
          }
        },
        {
          "type": "Feature",
          "properties": { "_id": 4, "_cost": 11 },
          "geometry": {
            "type": "LineString",
            "coordinates": [[-113.132497, 41.902277], [-117.452899, 40.967659]]
          }
        }
      ]
    };

    const graph = new Graph(geojson);
    graph.contractGraph();
    const finder = graph.createPathfinder({ ids: true, path: true });
    const result = finder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);

    assertEqual(result.total_cost, 22);
    assertDeepEqual(result.ids, [1, 2, 3, 4]);
    assert(result.path.type === 'FeatureCollection');
    assertEqual(result.path.features.length, 4);
  });

  it('Reverse GeoJSON coordinate-based pathfinding', () => {
    // From original routing-tests.js  
    const geojson = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": { "_id": 1, "_cost": 1 },
          "geometry": {
            "type": "LineString",
            "coordinates": [[-116.452899, 41.967659], [-113.330402, 43.245203]]
          }
        },
        {
          "type": "Feature", 
          "properties": { "_id": 2, "_cost": 3 },
          "geometry": {
            "type": "LineString",
            "coordinates": [[-113.330402, 43.245203], [-109.306339, 42.244785]]
          }
        },
        {
          "type": "Feature",
          "properties": { "_id": 3, "_cost": 7 },
          "geometry": {
            "type": "LineString", 
            "coordinates": [[-109.306339, 42.244785], [-113.132497, 41.902277]]
          }
        },
        {
          "type": "Feature",
          "properties": { "_id": 4, "_cost": 11 },
          "geometry": {
            "type": "LineString",
            "coordinates": [[-113.132497, 41.902277], [-117.452899, 40.967659]]
          }
        }
      ]
    };

    const graph = new Graph(geojson);
    graph.contractGraph();
    const finder = graph.createPathfinder({ ids: true, path: true });
    const result = finder.queryContractionHierarchy([-117.452899, 40.967659], [-116.452899, 41.967659]);

    assertEqual(result.total_cost, 22);
    assertDeepEqual(result.ids, [4, 3, 2, 1]);
    assert(result.path.type === 'FeatureCollection');
    assertEqual(result.path.features.length, 4);
  });

  it('Empty graph handling', () => {
    const graph = new Graph();
    // Contract empty graph should not crash
    graph.contractGraph();
    
    const finder = graph.createPathfinder();
    const result = finder.queryContractionHierarchy('A', 'B');
    
    assertEqual(result.total_cost, 0);
  });

  it('Single node queries', () => {
    const graph = new Graph();
    graph.addEdge('A', 'B', { _id: 1, _cost: 5 });
    graph.contractGraph();
    const finder = graph.createPathfinder();
    
    // Same start and end should return 0 cost
    const result = finder.queryContractionHierarchy('A', 'A');
    assertEqual(result.total_cost, 0);
  });

});

runner.summary();