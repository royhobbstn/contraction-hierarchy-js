//

const fs = require('fs').promises;
const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;

const { getComparator, toBestRoute } = require('./common.js');

exports.runArcFlagsDijkstraPreProcess = runArcFlagsDijkstraPreProcess;
exports.runArcFlagsDijkstra = runArcFlagsDijkstra;

function runArcFlagsDijkstraPreProcess(adj_list, edge_hash, start, cost_field) {
  const heap = new FibonacciHeap();
  const key_to_nodes = {};

  const dist = {}; // distances to each node
  const prev = {}; // node to parent_node lookup
  const visited = {}; // node has been fully explored

  let current = start;
  dist[start] = 0;

  do {
    adj_list[current].forEach(node => {
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
  } while (current);

  return prev;
}

function runArcFlagsDijkstra(
  adj_list,
  edge_hash,
  start,
  end,
  cost_field,
  pt_region_lookup
) {
  if (start === end) {
    return {
      distance: 0,
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

  const target_region = pt_region_lookup[end];

  do {
    adj_list[current].forEach(node => {
      // this optimization may not hold true for directed graphs
      if (visited[node]) {
        return;
      }

      const str = `${current}|${node}`;
      const segment = edge_hash[str];

      // use arcFlags to rule out non-shortest paths
      const flags = segment.properties.arcFlags;

      if (!flags[target_region]) {
        return;
      }

      const segment_distance = segment.properties[cost_field];
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

    const elem = heap.extractMinimum();

    if (elem) {
      current = elem.value;
    }
    else {
      current = '';
    }

    if (current === end) {
      current = '';
    }
  } while (current);

  const route = toBestRoute(end, prev, edge_hash);
  const segments = route.features.map(f => f.properties.ID);
  const distance = route.features.reduce((acc, feat) => {
    return acc + feat.properties[cost_field];
  }, 0);

  return { distance, segments, route };
}
