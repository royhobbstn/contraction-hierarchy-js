//

const fs = require('fs').promises;
const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;

const { getComparator, toBestRoute } = require('./common.js');

const debug = false;
const save_output = false;

exports.runDijkstra = runDijkstra;

function runDijkstra(adj_list, edge_hash, start, end, cost_field, vertex) {
  // quick exit for start === end
  if (start === end) {
    return {
      distance: 0,
      segments: [],
      route: {
        type: 'FeatureCollection',
        features: []
      }
    };
  }

  if (debug) {
    console.log('dij', { start, end, vertex });
  }

  const heap = new FibonacciHeap();
  const key_to_nodes = {};

  const dist = {}; // distances to each node
  const prev = {}; // node to parent_node lookup
  const visited = {}; // node has been fully explored

  let current = start;
  dist[start] = 0;

  do {
    adj_list[current]
      .filter(node => {
        // maybe not necessary?
        // this is a modification for contraction hierarchy.  otherwise vertex===undefined
        return node !== vertex;
      })
      .forEach(node => {
        // this optimization may not hold true for directed graphs
        if (visited[node]) {
          return;
        }

        const segment_distance =
          edge_hash[`${current}|${node}`].properties[cost_field];
        const proposed_distance = dist[current] + segment_distance;

        if (proposed_distance < getComparator(dist[node])) {
          if (dist[node] !== undefined) {
            heap.decreaseKey(key_to_nodes[node], proposed_distance);
          } else {
            key_to_nodes[node] = heap.insert(proposed_distance, node);
          }
          dist[node] = proposed_distance;
          prev[node] = current;
        }
      });
    visited[current] = true;

    // get lowest value from heap
    const elem = heap.extractMinimum();

    if (elem) {
      current = elem.value;
    } else {
      current = '';
    }

    // exit early if current node becomes end node
    if (current === end) {
      current = '';
    }
  } while (current);

  const route = toBestRoute(end, prev, edge_hash);

  if (save_output) {
    fs.writeFile('./single_dijkstra.geojson', JSON.stringify(route), 'utf8');

    const pm = Object.keys(visited).map(key => {
      const split = key.split(',').map(n => Number(n));
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: split
        }
      };
    });

    const pointmap = {
      type: 'FeatureCollection',
      features: pm
    };

    if (save_output) {
      fs.writeFile(
        './dijkstra_radius.geojson',
        JSON.stringify(pointmap),
        'utf8'
      );
    }
  }

  const segments = route.features.map(f => f.properties.ID);
  const distance = route.features.reduce((acc, feat) => {
    return acc + feat.properties[cost_field];
  }, 0);

  segments.sort((a, b) => a - b);

  return { distance, segments, route };
}
