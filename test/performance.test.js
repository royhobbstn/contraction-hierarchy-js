import runner from './test-runner.js';
import { Graph } from '../index.js';

describe('Performance Tests', () => {

  it('Large manual graph performance', () => {
    const graph = new Graph();
    
    // Create a larger test network
    const nodeCount = 100;
    const edgeCount = 300;
    
    console.log(`      Building graph with ${nodeCount} nodes and ${edgeCount} edges...`);
    
    // Add nodes in a grid-like pattern with some random connections
    let edgeId = 1;
    for (let i = 0; i < nodeCount - 1; i++) {
      // Sequential connections
      graph.addEdge(`node_${i}`, `node_${i + 1}`, { _id: edgeId++, _cost: Math.random() * 10 + 1 });
      
      // Some random connections for complexity
      if (Math.random() > 0.7) {
        const randomTarget = Math.floor(Math.random() * nodeCount);
        if (randomTarget !== i && edgeId <= edgeCount) {
          graph.addEdge(`node_${i}`, `node_${randomTarget}`, { _id: edgeId++, _cost: Math.random() * 20 + 5 });
        }
      }
    }

    console.log(`      Contracting graph...`);
    const contractStart = Date.now();
    graph.contractGraph();
    const contractTime = Date.now() - contractStart;
    console.log(`      Contraction took ${contractTime}ms`);

    const finder = graph.createPathfinder({ ids: true });

    // Test pathfinding performance
    const queries = 100;
    console.log(`      Running ${queries} pathfinding queries...`);
    
    const queryStart = Date.now();
    for (let i = 0; i < queries; i++) {
      const start = `node_${Math.floor(Math.random() * nodeCount)}`;
      const end = `node_${Math.floor(Math.random() * nodeCount)}`;
      const result = finder.queryContractionHierarchy(start, end);
      // Basic sanity check
      assert(typeof result.total_cost === 'number');
    }
    const queryTime = Date.now() - queryStart;
    const avgQueryTime = queryTime / queries;
    
    console.log(`      ${queries} queries took ${queryTime}ms (avg: ${avgQueryTime.toFixed(2)}ms per query)`);
    
    // Performance assertions
    assert(contractTime < 30000, `Contraction took too long: ${contractTime}ms`);
    assert(avgQueryTime < 50, `Average query time too slow: ${avgQueryTime}ms`);
  });

  it('GeoJSON network performance', () => {
    // Create a more complex GeoJSON network
    const features = [];
    const gridSize = 10;
    let edgeId = 1;

    // Create a grid network
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const currentLng = -116 + (x * 0.1);
        const currentLat = 41 + (y * 0.1);
        
        // Horizontal connections
        if (x < gridSize - 1) {
          const nextLng = currentLng + 0.1;
          features.push({
            type: "Feature",
            properties: { _id: edgeId++, _cost: Math.random() * 5 + 1 },
            geometry: {
              type: "LineString",
              coordinates: [[currentLng, currentLat], [nextLng, currentLat]]
            }
          });
        }
        
        // Vertical connections  
        if (y < gridSize - 1) {
          const nextLat = currentLat + 0.1;
          features.push({
            type: "Feature", 
            properties: { _id: edgeId++, _cost: Math.random() * 5 + 1 },
            geometry: {
              type: "LineString",
              coordinates: [[currentLng, currentLat], [currentLng, nextLat]]
            }
          });
        }
      }
    }

    const geojson = { type: "FeatureCollection", features };
    
    console.log(`      Testing GeoJSON with ${features.length} edges...`);
    
    const graph = new Graph(geojson);
    
    console.log(`      Contracting GeoJSON graph...`);
    const contractStart = Date.now();
    graph.contractGraph();
    const contractTime = Date.now() - contractStart;
    console.log(`      Contraction took ${contractTime}ms`);

    const finder = graph.createPathfinder({ path: true });

    // Test some coordinate-based queries
    const queries = 50;
    console.log(`      Running ${queries} coordinate-based queries...`);
    
    const queryStart = Date.now();
    for (let i = 0; i < queries; i++) {
      const startLng = -116 + Math.random();
      const startLat = 41 + Math.random();
      const endLng = -116 + Math.random();  
      const endLat = 41 + Math.random();
      
      // Round to grid coordinates
      const gridStartLng = -116 + Math.floor((startLng + 116) * 10) * 0.1;
      const gridStartLat = 41 + Math.floor((startLat - 41) * 10) * 0.1;
      const gridEndLng = -116 + Math.floor((endLng + 116) * 10) * 0.1;
      const gridEndLat = 41 + Math.floor((endLat - 41) * 10) * 0.1;
      
      const result = finder.queryContractionHierarchy(
        [gridStartLng, gridStartLat], 
        [gridEndLng, gridEndLat]
      );
      assert(typeof result.total_cost === 'number');
    }
    const queryTime = Date.now() - queryStart;
    const avgQueryTime = queryTime / queries;
    
    console.log(`      ${queries} queries took ${queryTime}ms (avg: ${avgQueryTime.toFixed(2)}ms per query)`);
    
    // Performance assertions
    assert(contractTime < 15000, `GeoJSON contraction took too long: ${contractTime}ms`);
    assert(avgQueryTime < 30, `Average query time too slow: ${avgQueryTime}ms`);
  });

  it('Memory usage patterns', () => {
    const initialMemory = process.memoryUsage();
    
    // Create and contract a moderately sized graph
    const graph = new Graph();
    for (let i = 0; i < 200; i++) {
      graph.addEdge(`node_${i}`, `node_${(i + 1) % 200}`, { _id: i + 1, _cost: Math.random() * 10 });
    }
    
    graph.contractGraph();
    const finder = graph.createPathfinder();
    
    // Run many queries to test memory stability
    for (let i = 0; i < 1000; i++) {
      const start = `node_${Math.floor(Math.random() * 200)}`;
      const end = `node_${Math.floor(Math.random() * 200)}`;
      finder.queryContractionHierarchy(start, end);
    }
    
    const finalMemory = process.memoryUsage();
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    
    console.log(`      Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    
    // Memory growth should be reasonable (less than 100MB for this test)
    assert(memoryGrowth < 100 * 1024 * 1024, `Excessive memory growth: ${memoryGrowth} bytes`);
  });

});

runner.summary();