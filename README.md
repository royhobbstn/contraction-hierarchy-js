# contraction-hierarchy-js

:rocket: **Scary-Fast Pathfinding for Node.js using [Contraction Hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies)**

[![npm version](https://badge.fury.io/js/contraction-hierarchy-js.svg)](https://badge.fury.io/js/contraction-hierarchy-js)
[![Node.js Version](https://img.shields.io/node/v/contraction-hierarchy-js.svg)](https://nodejs.org/)

A high-performance JavaScript implementation of contraction hierarchies for lightning-fast pathfinding on large networks. Perfect for road networks, transportation planning, and any scenario where you need to find optimal paths quickly on static or semi-static graphs.

## 🎯 When to Use Contraction Hierarchies

Contraction hierarchies excel when you have **static data that changes infrequently** and need to perform **many pathfinding queries**. Perfect use cases include:

- **Road networks** (without real-time traffic)
- **Public transportation** systems 
- **Logistics and delivery** route optimization
- **Game pathfinding** on static maps
- **Network analysis** on large graphs

The key advantage: spend time once during preprocessing to get **100x-300x faster** pathfinding queries compared to traditional algorithms like Dijkstra or A*.

## 📊 Performance

Real-world performance comparison on a USA major roads network:

| Algorithm | Nodes | Edges | Preprocessing | 10,000 Routes | Per Route |
|-----------|-------|--------|--------------|---------------|-----------|
| Dijkstra (Ngraph) | 135,308 | 340,981 | 0ms | 1,232,269ms | **123.23ms** |
| **Contraction Hierarchy** | 135,308 | 340,981 | 972,786ms | 3,616ms | **0.36ms** |

**Result: 342x faster** query performance after preprocessing! 🚀

## 🛠 Installation

```bash
npm install contraction-hierarchy-js
```

**Requirements:**
- Node.js 16.0.0 or higher
- Modern ES modules support

## 🚀 Quick Start

### Basic Example with GeoJSON

```javascript
import fs from 'fs';
import { Graph, CoordinateLookup } from 'contraction-hierarchy-js';

// Load your network data
const geojson = JSON.parse(fs.readFileSync('path/to/network.geojson', 'utf8'));

// Create and contract the graph (one-time preprocessing)
const graph = new Graph(geojson);
console.log('Contracting graph... this may take a while');
graph.contractGraph();
console.log('Contraction complete!');

// Create a pathfinder with desired output options
const finder = graph.createPathfinder({ 
  ids: true,      // Return edge IDs
  path: true,     // Return GeoJSON path
  nodes: true,    // Return node sequence  
  properties: true // Return edge properties
});

// Find closest network points to your coordinates
const lookup = new CoordinateLookup(graph);
const start = lookup.getClosestNetworkPt(-116.45, 41.96);
const end = lookup.getClosestNetworkPt(-117.45, 40.96);

// Query for optimal path (lightning fast!)
const result = finder.queryContractionHierarchy(start, end);

console.log('Path found!');
console.log('Total cost:', result.total_cost);
console.log('Edge IDs:', result.ids);
console.log('Nodes:', result.nodes);
console.log('GeoJSON path:', result.path);
```

### Manual API for Non-GeoJSON Data

```javascript
import { Graph } from 'contraction-hierarchy-js';

// Create empty graph
const graph = new Graph();

// Add edges manually (great for directed networks)
graph.addEdge('A', 'B', { _id: 1, _cost: 5.2 });
graph.addEdge('B', 'C', { _id: 2, _cost: 3.1 });
graph.addEdge('A', 'C', { _id: 3, _cost: 8.7 });

// Contract and query
graph.contractGraph();
const finder = graph.createPathfinder({ ids: true, nodes: true });
const path = finder.queryContractionHierarchy('A', 'C');

console.log(path);
// Output: { total_cost: 8.3, ids: [1, 2], nodes: ['A', 'B', 'C'] }
```

## 📖 Complete API Reference

### Graph Constructor

```javascript
const graph = new Graph(geojson, options);
```

**Parameters:**
- `geojson` *(optional)*: GeoJSON FeatureCollection with LineString features
  - Each feature requires `properties._id` (unique number) and `properties._cost` (number)
  - Networks are treated as undirected (use manual API for directed graphs)
- `options` *(optional)*: Configuration object
  - `debugMode` *(boolean)*: Enable detailed logging (default: false)

### Graph Methods

#### `addEdge(start, end, properties, geometry, isUndirected)`

Add an edge manually (alternative to GeoJSON input).

**Parameters:**
- `start` *(string)*: Source node identifier
- `end` *(string)*: Target node identifier  
- `properties` *(object)*: Must include `_id` (unique number) and `_cost` (number)
- `geometry` *(array, optional)*: Array of [lng, lat] coordinates for edge geometry
- `isUndirected` *(boolean, optional)*: Add reverse edge automatically (default: false)

```javascript
// Directed edge
graph.addEdge('A', 'B', { _id: 1, _cost: 10, type: 'highway' });

// Undirected edge (adds both A->B and B->A)
graph.addEdge('A', 'B', { _id: 1, _cost: 10 }, null, true);

// With geometry
graph.addEdge('A', 'B', { _id: 1, _cost: 10 }, [[-116.1, 41.2], [-116.0, 41.3]]);
```

#### `contractGraph()`

Build the contraction hierarchy (preprocessing step).

⚠️ **This can take significant time for large networks!** Use `debugMode: true` to monitor progress.

```javascript
const graph = new Graph(data, { debugMode: true });
graph.contractGraph(); // Watch the console for progress
```

#### `createPathfinder(options)`

Create a pathfinder instance with output configuration.

**Options:**
- `ids` *(boolean)*: Return array of edge IDs in path order
- `path` *(boolean)*: Return GeoJSON FeatureCollection of path
- `nodes` *(boolean)*: Return array of node identifiers in path order
- `properties` *(boolean)*: Return array of edge properties in path order

```javascript
// Minimal output (just cost)
const finder1 = graph.createPathfinder();

// Full output
const finder2 = graph.createPathfinder({ 
  ids: true, 
  path: true, 
  nodes: true, 
  properties: true 
});
```

### Pathfinding

#### `finder.queryContractionHierarchy(start, end)`

Find optimal path between two points.

**Parameters:**
- `start`: Node identifier (string) or coordinate array [lng, lat]
- `end`: Node identifier (string) or coordinate array [lng, lat]

**Returns object with:**
- `total_cost` *(number)*: Total path cost
- `ids` *(array, optional)*: Edge IDs if requested
- `path` *(GeoJSON, optional)*: Path geometry if requested
- `nodes` *(array, optional)*: Node sequence if requested  
- `properties` *(array, optional)*: Edge properties if requested

```javascript
// Using node identifiers
const path1 = finder.queryContractionHierarchy('node_123', 'node_456');

// Using coordinates (requires exact match with network)
const path2 = finder.queryContractionHierarchy([-116.45, 41.96], [-117.45, 40.96]);
```

### Coordinate Lookup

When using coordinates, they must exactly match network endpoints. Use `CoordinateLookup` to find the closest network points to arbitrary coordinates.

```javascript
import { CoordinateLookup } from 'contraction-hierarchy-js';

const lookup = new CoordinateLookup(graph);

// Find closest network points
const startPt = lookup.getClosestNetworkPt(-116.456, 41.967);
const endPt = lookup.getClosestNetworkPt(-117.123, 40.834);

// Use these points for pathfinding
const path = finder.queryContractionHierarchy(startPt, endPt);
```

### Serialization (Save/Load Networks)

Avoid recomputing contractions by saving/loading preprocessed networks.

#### JSON Format

```javascript
// Save contracted network
const serialized = graph.saveCH();
fs.writeFileSync('network.json', serialized);

// Load contracted network
const networkData = fs.readFileSync('network.json', 'utf8');
const graph = new Graph();
graph.loadCH(networkData);
```

#### Protocol Buffer Format (Recommended)

Much more compact than JSON - ideal for large networks.

```javascript
// Save as PBF (Node.js only)
graph.savePbfCH('network.pbf');

// Load PBF (works in browser and Node.js)
const buffer = fs.readFileSync('network.pbf');
const graph = new Graph();
graph.loadPbfCH(buffer);
```

## 🧪 Testing

### Run the Test Suite

```bash
# Run all tests
npm test

# Run specific test files
cd test
node routing-tests.js           # Core functionality tests
node missing-nodes-bug-test.js  # Regression tests
node simple-performance-test.js # Performance validation
```

### Test Your Own Data

Create a simple test with your network:

```javascript
import { Graph } from 'contraction-hierarchy-js';

// Test with your GeoJSON
const graph = new Graph(yourGeojsonData, { debugMode: true });
graph.contractGraph();

const finder = graph.createPathfinder({ ids: true, nodes: true });
const result = finder.queryContractionHierarchy(startCoord, endCoord);

console.log('Path found:', result);
```

## 📁 GeoJSON Network Format

Your GeoJSON must follow this structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "_id": 1,
        "_cost": 5.2,
        "highway": "primary",
        "name": "Main Street"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-116.1, 41.2], [-116.0, 41.3]]
      }
    }
  ]
}
```

**Required properties:**
- `_id`: Unique numeric identifier for each edge
- `_cost`: Numeric cost/weight for pathfinding

**Optional properties:** Any additional data you want preserved in results.

## 🔧 Advanced Usage

### Memory Management for Large Networks

For large datasets, you may need to increase Node.js memory:

```bash
# Increase memory limit to 8GB
node --max-old-space-size=8192 your-script.js

# For very large networks (16GB)
node --max-old-space-size=16384 your-script.js
```

### Directed vs Undirected Networks

```javascript
// GeoJSON networks are automatically undirected
const graph = new Graph(geojsonData);

// Manual API allows directed networks
const directedGraph = new Graph();
directedGraph.addEdge('A', 'B', { _id: 1, _cost: 5 }); // Only A->B
directedGraph.addEdge('B', 'A', { _id: 2, _cost: 7 }); // Different cost for B->A

// Or create undirected edges automatically
directedGraph.addEdge('C', 'D', { _id: 3, _cost: 3 }, null, true); // Both C->D and D->C
```

### Debugging and Monitoring

```javascript
const graph = new Graph(data, { debugMode: true });

// Monitor contraction progress
console.time('contraction');
graph.contractGraph();
console.timeEnd('contraction');

// Check graph statistics
console.log('Nodes:', Object.keys(graph._nodeToIndexLookup).length);
console.log('Edges:', graph._currentEdgeIndex + 1);
```

## ⚠️ Known Limitations

- **Large networks**: Contraction time grows significantly with network size
- **Memory usage**: Very large networks may require increased Node.js memory limits  
- **Preprocessing cost**: Not suitable for highly dynamic networks that change frequently
- **Browser support**: While the core library works in browsers, some features (like PBF saving) are Node.js only

## 🙏 Credits

This library was inspired by and builds upon several excellent projects:

- **[NGraph](https://github.com/anvaka/ngraph.path)**: For pathfinding algorithms and graph structures
- **[geokdbush](https://github.com/mourner/geokdbush)**: Spatial indexing for coordinate lookup  
- **[TinyQueue](https://github.com/mourner/tinyqueue)**: High-performance priority queue implementation

Special thanks to the open source community for making fast, reliable pathfinding accessible to everyone.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Issues & Contributing

Found a bug or want to contribute? 

- **Issues**: [GitHub Issues](https://github.com/royhobbstn/contraction-hierarchy-js/issues)
- **Discussions**: [GitHub Discussions](https://github.com/royhobbstn/contraction-hierarchy-js/discussions)

We welcome contributions, bug reports, and feature requests!

---

**Happy pathfinding!** 🗺️✨