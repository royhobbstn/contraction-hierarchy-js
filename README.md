# contraction-hierarchy-js

:scream: Scary-Fast Pathfinding for NodeJS using [Contraction Hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies)

Currently designed specifically for undirected GeoJSON networks. (future adaptations and enhancements likely!)

## Quickstart


```
const fs = require('fs');
const { Graph, CoordinateLookup } = require('coordinate-lookup-js');

const geofile = fs.readFileSync('./yourfile.geojson', 'utf8');
const geojson = JSON.parse(geofile);

const graph = new Graph(geojson);

// build hierarchy.  this step may take a while.
graph.contractGraph();

const finder = graph.createPathfinder({ ids: true, path: true });

// create a coordinate lookup to be able to input arbitrary coordinate pairs
// and return the nearest coordinates in the network
const lookup = new CoordinateLookup(graph);
const coords1 = lookup.getClosestNetworkPt(-101.359, 43.341);
const coords2 = lookup.getClosestNetworkPt(-91.669, 40.195);


const path = finder.queryContractionHierarchy(coords1, coords2);

console.log(path);
```

## Benchmarks

Benchmarks vs Plain Dijkstra (using [geojson-dijkstra](https://github.com/royhobbstn/geojson-dijkstra))

(coming soon)


## API

```
const graph = new Graph(geojson);
```

Creates a new `Graph` object where `geojson` is your input geojson data.  Your features properties object must contain a unique `_id` (number) and a `_cost` (number).

```
graph.contractGraph();
```

The `contractGraph` method will build a contraction hierarchy from your input data.  This step could take a while!  For extremely large datasets (example: highly detailed road networks of large geographic areas) the build time could extend for hours, or not be feasible at all.


```
const finder = graph.createPathfinder(options);
```

The `createPathfinder` method creates a pathFinder object with which you can use to query your network.  The main purpose is to be able to configure graph outputs with the `options` object.

By default, any queries you make on the network will return with `{ total_cost: (number) }` for your given path.  To add additional properties, you can supply either/or/none of the following for the `options` object:

`{ids: true}`:  Will return an ordered list of edge IDs corresponding to the `_id` attribute in the original geojson.

`{path: true}`: Will return a geojson linestring path with all original geojson attributes.


```
const path = finder.queryContractionHierarchy(start, end);
```

To query the graph, use the `queryContractionHierarchy` method.  It expects `start` and `end` coordinates, where each is in the form: `[-110.45, 35.4]`  ([lng, lat])


## Helpers

```
const lookup = new CoordinateLookup(graph);
const coords1 = lookup.getClosestNetworkPt(-101.359, 43.341);
const coords2 = lookup.getClosestNetworkPt(-91.669, 40.195);
```

When using `queryContractionHierarchy`, your start and end points must correspond exactly with start/end points of lines in your graph.  Because this can be difficult to arrange without a lot of manual work, I've built a helper to be able to find the closest coordinates in your graph to any arbitrary coordinate you supply.


## Load and Save

Implemented.  TODO on documentation.


## Issues

Larger networks are problematic.  Time to contract is obviously much higher.  Memory issues start to become a factor as well.  Become aquainted with the `--max_old_space_size=` command line arg for now.


## Future

**Directed graphs** I've had this piece *mostly* working in the past, and will likely revisit this again in the future.

**Using a contraction hierarchy with custom data (non-geojson)** This should be possible with very little additional work after directed graphs are implemented.