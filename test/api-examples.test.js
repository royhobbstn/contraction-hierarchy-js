import runner from './test-runner.js';
import { Graph, CoordinateLookup } from '../index.js';
import fs from 'fs';

// Test data
const basicGeojson = {
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

// These function declarations are duplicated in the async IIFE below - remove them

// Run all tests
(async () => {
  await describe('README API Examples', async () => {
    await it('Basic GeoJSON workflow with CoordinateLookup', () => {
      // Example from README lines 47-81
      const graph = new Graph(basicGeojson);
      graph.contractGraph();

      const finder = graph.createPathfinder({ 
        ids: true,
        path: true,
        nodes: true,
        properties: true 
      });

      const lookup = new CoordinateLookup(graph);
      const start = lookup.getClosestNetworkPt(-116.45, 41.96);
      const end = lookup.getClosestNetworkPt(-117.45, 40.96);

      const result = finder.queryContractionHierarchy(start, end);

      assertEqual(result.total_cost, 22);
      assertDeepEqual(result.ids, [1, 2, 3, 4]);
      assert(result.nodes.length === 5);
      assert(result.path.type === 'FeatureCollection');
      assert(result.path.features.length === 4);
    });

    await it('Manual API for Non-GeoJSON Data', () => {
      // Example from README lines 85-103
      const graph = new Graph();

      graph.addEdge('A', 'B', { _id: 1, _cost: 5.2 });
      graph.addEdge('B', 'C', { _id: 2, _cost: 3.1 });
      graph.addEdge('A', 'C', { _id: 3, _cost: 8.7 });

      graph.contractGraph();
      const finder = graph.createPathfinder({ ids: true, nodes: true });
      const path = finder.queryContractionHierarchy('A', 'C');

      assertEqual(path.total_cost, 8.3);
      assertDeepEqual(path.ids, [1, 2]);
      assertDeepEqual(path.nodes, ['A', 'B', 'C']);
    });

    await it('Graph constructor with debug mode', () => {
      // Example from README line 151
      const graph = new Graph(basicGeojson, { debugMode: true });
      
      // Should not throw
      graph.contractGraph();
      
      // Should work normally even with debug mode
      const finder = graph.createPathfinder();
      const result = finder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      assertEqual(result.total_cost, 22);
    });

    await it('addEdge with different parameters', () => {
      const graph = new Graph();

      // Directed edge (README line 135)
      graph.addEdge('A', 'B', { _id: 1, _cost: 10, type: 'highway' });

      // Undirected edge (README line 138)
      graph.addEdge('C', 'D', { _id: 2, _cost: 5 }, null, true);

      // With geometry (README line 141)
      graph.addEdge('E', 'F', { _id: 3, _cost: 7 }, [[-116.1, 41.2], [-116.0, 41.3]]);

      graph.contractGraph();
      const finder = graph.createPathfinder({ ids: true });

      // Test directed edge
      const pathAB = finder.queryContractionHierarchy('A', 'B');
      assertEqual(pathAB.total_cost, 10);
      
      // Test that reverse doesn't work for directed edge
      const pathBA = finder.queryContractionHierarchy('B', 'A');
      assertEqual(pathBA.total_cost, 0); // No path

      // Test undirected edge works both ways
      const pathCD = finder.queryContractionHierarchy('C', 'D');
      assertEqual(pathCD.total_cost, 5);
      const pathDC = finder.queryContractionHierarchy('D', 'C');
      assertEqual(pathDC.total_cost, 5);

      // Test edge with geometry
      const pathEF = finder.queryContractionHierarchy('E', 'F');
      assertEqual(pathEF.total_cost, 7);
    });

    await it('createPathfinder with different output options', () => {
      const graph = new Graph(basicGeojson);
      graph.contractGraph();

      // Minimal output (README line 167)
      const finder1 = graph.createPathfinder();
      const result1 = finder1.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      assertEqual(result1.total_cost, 22);
      assert(!result1.ids);
      assert(!result1.path);
      assert(!result1.nodes);

      // Full output (README line 170)
      const finder2 = graph.createPathfinder({ 
        ids: true, 
        path: true, 
        nodes: true, 
        properties: true 
      });
      const result2 = finder2.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      assertEqual(result2.total_cost, 22);
      assert(Array.isArray(result2.ids));
      assert(result2.path.type === 'FeatureCollection');
      assert(Array.isArray(result2.nodes));
      assert(Array.isArray(result2.properties));
    });

    await it('queryContractionHierarchy with different input types', () => {
      const graph = new Graph();
      graph.addEdge('node_123', 'node_456', { _id: 1, _cost: 10 });
      graph.contractGraph();
      const finder = graph.createPathfinder({ ids: true });

      // Using node identifiers (README line 197)
      const path1 = finder.queryContractionHierarchy('node_123', 'node_456');
      assertEqual(path1.total_cost, 10);

      // Test with GeoJSON coordinates
      const geojsonGraph = new Graph(basicGeojson);
      geojsonGraph.contractGraph();
      const geojsonFinder = geojsonGraph.createPathfinder();
      
      // Using coordinates (README line 200)
      const path2 = geojsonFinder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      assertEqual(path2.total_cost, 22);
    });

    await it('CoordinateLookup functionality', () => {
      // Example from README lines 207-218
      const graph = new Graph(basicGeojson);
      graph.contractGraph();
      const finder = graph.createPathfinder();

      const lookup = new CoordinateLookup(graph);

      // Find closest network points
      const startPt = lookup.getClosestNetworkPt(-116.456, 41.967);
      const endPt = lookup.getClosestNetworkPt(-117.123, 40.834);

      // Should return coordinate arrays
      assert(Array.isArray(startPt));
      assert(Array.isArray(endPt));
      assertEqual(startPt.length, 2);
      assertEqual(endPt.length, 2);

      // Use these points for pathfinding
      const path = finder.queryContractionHierarchy(startPt, endPt);
      assert(path.total_cost > 0);
    });

    await it('CoordinateLookup requires GeoJSON', () => {
      // Should throw for non-GeoJSON graph
      const graph = new Graph();
      graph.addEdge('A', 'B', { _id: 1, _cost: 5 });
      
      assertThrows(() => {
        new CoordinateLookup(graph);
      }, 'Cannot use Coordinate Lookup on a non-GeoJson network');
    });
  });

  await describe('Serialization Examples', async () => {
    await it('JSON serialization (saveCH/loadCH)', () => {
      // Example from README lines 227-235
      const originalGraph = new Graph(basicGeojson);
      originalGraph.contractGraph();

      // Save contracted network
      const serialized = originalGraph.saveCH();
      assert(typeof serialized === 'string');

      // Load contracted network
      const newGraph = new Graph();
      newGraph.loadCH(serialized);

      // Test that loaded graph works
      const finder = newGraph.createPathfinder();
      const result = finder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      assertEqual(result.total_cost, 22);
    });

    await it('Protocol Buffer serialization (savePbfCH/loadPbfCH)', async () => {
      // Example from README lines 241-249
      const originalGraph = new Graph(basicGeojson);
      originalGraph.contractGraph();

      // Save as PBF
      const tempFile = '/tmp/test-network.pbf';
      await originalGraph.savePbfCH(tempFile);
      assert(fs.existsSync(tempFile));

      // Load PBF
      const buffer = fs.readFileSync(tempFile);
      const newGraph = new Graph();
      newGraph.loadPbfCH(buffer);

      // Test that loaded graph works
      const finder = newGraph.createPathfinder();
      const result = finder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      assertEqual(result.total_cost, 22);

      // Cleanup
      fs.unlinkSync(tempFile);
    });
  });

  await describe('Advanced Usage Examples', async () => {
    await it('Directed vs Undirected Networks', () => {
      // Examples from README lines 331-341
      
      // GeoJSON networks are automatically undirected
      const geojsonGraph = new Graph(basicGeojson);
      geojsonGraph.contractGraph();
      const geojsonFinder = geojsonGraph.createPathfinder();
      
      // Should work both directions
      const forward = geojsonFinder.queryContractionHierarchy([-116.452899, 41.967659], [-117.452899, 40.967659]);
      const reverse = geojsonFinder.queryContractionHierarchy([-117.452899, 40.967659], [-116.452899, 41.967659]);
      assertEqual(forward.total_cost, 22);
      assertEqual(reverse.total_cost, 22);

      // Manual API allows directed networks
      const directedGraph = new Graph();
      directedGraph.addEdge('A', 'B', { _id: 1, _cost: 5 }); // Only A->B
      directedGraph.addEdge('B', 'A', { _id: 2, _cost: 7 }); // Different cost for B->A
      directedGraph.contractGraph();
      const directedFinder = directedGraph.createPathfinder();

      const pathAB = directedFinder.queryContractionHierarchy('A', 'B');
      const pathBA = directedFinder.queryContractionHierarchy('B', 'A');
      assertEqual(pathAB.total_cost, 5);
      assertEqual(pathBA.total_cost, 7);

      // Create undirected edges automatically
      const autoGraph = new Graph();
      autoGraph.addEdge('C', 'D', { _id: 3, _cost: 3 }, null, true); // Both C->D and D->C
      autoGraph.contractGraph();
      const autoFinder = autoGraph.createPathfinder();

      const pathCD = autoFinder.queryContractionHierarchy('C', 'D');
      const pathDC = autoFinder.queryContractionHierarchy('D', 'C');
      assertEqual(pathCD.total_cost, 3);
      assertEqual(pathDC.total_cost, 3);
    });

    await it('Edge properties preservation', () => {
      const graph = new Graph();
      graph.addEdge('A', 'B', { _id: 1, _cost: 5, highway: 'primary', name: 'Main St' });
      graph.addEdge('B', 'C', { _id: 2, _cost: 3, highway: 'secondary', name: 'Side St' });
      graph.contractGraph();

      const finder = graph.createPathfinder({ properties: true });
      const result = finder.queryContractionHierarchy('A', 'C');

      assertEqual(result.total_cost, 8);
      assert(Array.isArray(result.properties));
      assertEqual(result.properties.length, 2);
      assertEqual(result.properties[0].highway, 'primary');
      assertEqual(result.properties[1].highway, 'secondary');
    });
  });

  runner.summary();
})();