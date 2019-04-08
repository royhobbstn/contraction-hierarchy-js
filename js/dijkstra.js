//

const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;

const { getComparator, toBestRoute } = require('./common.js');

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
          }
          else {
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
    }
    else {
      current = '';
    }

    // exit early if current node becomes end node
    if (current === end) {
      current = '';
    }
  } while (current);

  const route = toBestRoute(end, prev, edge_hash);

  const segments = route.features.map(f => f.properties.ID);
  const distance = route.features.reduce((acc, feat) => {
    return acc + feat.properties[cost_field];
  }, 0);

  segments.sort((a, b) => a - b);

  return { distance, segments, route };
}
