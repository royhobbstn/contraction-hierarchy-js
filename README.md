# contraction-hierarchy-js

:scream: Scary-Fast Pathfinding for NodeJS using [Contraction Hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies)

## When to Use a Contraction Hierarchy

The typical use case of using a Contraction hierarchy over Dijkstras Algorithm or a heuristic-based approach like A* is where you have static data that changes infrequently.  A good example would be a road network (one that doesnt not attempt to account for road closures and traffic).  Being able to pre-process networks up front allows for a greatly increased speed of pathfinding at runtime.


## Changes in 1.0

 - Ability to work with non-geojson data via a manual edge API.
 - Ability to work with directed networks (using the manual API)
 - Export data as GeoJSON, edge _id list, node list, or edge properties array.

## Quickstart


```
const fs = require('fs');
const { Graph, CoordinateLookup } = require('../index.js');

const geofile = fs.readFileSync('../networks/basic.geojson', 'utf8');
const geojson = JSON.parse(geofile);

const graph = new Graph(geojson);

// build hierarchy.  this step may take a while.
graph.contractGraph();

const finder = graph.createPathfinder({ ids: true, path: true, nodes: true, properties: true });

// create a coordinate lookup to be able to input arbitrary coordinate pairs
// and return the nearest coordinates in the network
const lookup = new CoordinateLookup(graph);
const coords1 = lookup.getClosestNetworkPt(-116.45, 41.96);
const coords2 = lookup.getClosestNetworkPt(-117.45, 40.96);

const path = finder.queryContractionHierarchy(coords1, coords2);

console.log(path);
```


## API

### Graph

```
const graph = new Graph(geojson, options);
```

Creates a new `Graph` object.

Both parameters; `geojson` and `options` are optional.

`geojson` is a GeoJSON linestring network; [example](https://raw.githubusercontent.com/royhobbstn/contraction-hierarchy-js/master/networks/basic.geojson).

  - Your features` properties` object must contain a unique `_id` (number) and a `_cost` (number).
  - GeoJSON networks are assumed to be undirected networks.  If you need to construct a directed network, please use the manual API.

`options` is an object with one attribute:

 - `debugMode` - defaults to false.  Set it to true to see miscellaneous data validation and contraction progress messages. 

### Graph Methods

```
graph.addEdge(start, end, edge_properties)
```

If your data is not GeoJSON, you can instead use the manual API.

  - `start` and `end` are string values corresponding to Node names.  `edge_properties` is an object listing the properties of the edge between the `start` and `end` nodes.
  - `edge_properties` object must contain a unique `_id` (number) and a `_cost` (number).

```
graph.contractGraph()
```

The `contractGraph` method will build a contraction hierarchy from your input data.  This step could take a while!  For extremely large datasets (example: highly detailed road networks of large geographic areas) the build time could extend for hours, or not be feasible at all.  I would highly recommend using `{ debugMode = true }` as your `options` parameter when initializing your `Graph`, to give you a gauge on the contraction progress of your network.

```
const finder = graph.createPathfinder(options);
```

The `createPathfinder` method creates a pathFinder object with which you can use to query your network.  The main purpose is to be able to configure graph outputs with the `options` object.


By default, any queries you make on the network will return with `{ total_cost: (number) }` for your given path.  To add additional properties, you can supply either/or/none of the following for the `options` object:

`{ids: true}`:  Will return an ordered array of edge IDs corresponding to the `_id` attribute in the original geojson.

`{path: true}`: Will return a geojson linestring path with all original geojson attributes.

`{nodes: true}`: Will return an ordered array of nodes that the path follows.

`{properties: true}`: Will return an ordered array of properties of each edge.


### Load and Save

```
graph.saveCH()
```

Create a stringified serialized version of your contracted network.  This is immensely useful to be able to re-use your contracted network, without having to incur the cost of contraction repeatedly.

```
const graph = graph.loadCH(network)
```

Load a stringified serialized contracted network (that was saved previously via the `saveCH` method).


### Finder Methods

```
const path = finder.queryContractionHierarchy(start, end);
```

To query the graph, use the `queryContractionHierarchy` method.  It expects `start` and `end` coordinates, where each is in the form: `[-110.45, 35.4]`  ([lng, lat])


## Coordinate Lookup

```
const lookup = new CoordinateLookup(graph);
const coords1 = lookup.getClosestNetworkPt(-101.359, 43.341);
const coords2 = lookup.getClosestNetworkPt(-91.669, 40.195);
```

When using `queryContractionHierarchy`, your start and end points must correspond exactly with start/end points of lines in your graph.  Because this can be difficult to arrange without a lot of manual work, I've built a helper to be able to find the closest coordinates in your graph to any arbitrary coordinate you supply.


## Performance

This is not benchmarking per se, as comparing a dijkstra implementation to a contraction hierarchy is not a fair comparison.  (Contraction hierarchies require a lengthy pre-processing step, whearas Dijkstras algorithm does not.)


## Issues

Larger networks are problematic.  Time to contract is obviously much higher.  Memory issues start to become a factor as well.  Become aquainted with the NodeJS command line argument: `--max_old_space_size=`.


