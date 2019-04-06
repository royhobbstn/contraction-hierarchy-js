//

const { toBestRoute, getComparator } = require('./common.js');
const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;


exports.queryContractionHierarchy = queryContractionHierarchy;

function queryContractionHierarchy(
  adj_list,
  edge_hash,
  start,
  end,
  cost_field,
  node_rank,
  id_list
) {
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

  const forward = {};
  forward.dist = {};
  forward.dist[start] = 0;
  const backward = {};
  backward.dist = {};
  backward.dist[end] = 0;

  const searchForward = doDijkstra(
    adj_list,
    edge_hash,
    forward,
    start,
    cost_field,
    node_rank,
    'forward',
    backward
  );
  const searchBackward = doDijkstra(
    adj_list,
    edge_hash,
    backward,
    end,
    cost_field,
    node_rank,
    'backward',
    forward
  );

  let forward_done = false;
  let backward_done = false;
  let sf, sb;

  let tentative_shortest_path = Infinity;
  let tentative_shortest_node = null;

  do {
    if (!forward_done) {
      sf = searchForward.next();
      if (sf.done) {
        forward_done = true;
      }
    }
    if (!backward_done) {
      sb = searchBackward.next();
      if (sb.done) {
        backward_done = true;
      }
    }
  } while (
    forward.dist[sf.value] < tentative_shortest_path ||
    backward.dist[sb.value] < tentative_shortest_path
  );

  const geojson_forward = toBestRoute(
    tentative_shortest_node,
    forward.prev,
    edge_hash
  );
  const geojson_backward = toBestRoute(
    tentative_shortest_node,
    backward.prev,
    edge_hash
  );

  const ff = geojson_forward.features.reduce((acc, g) => {
    const id = g.properties.ID;
    if (typeof id === 'string') {
      const nums = id.split(',');
      acc = [...acc, ...nums];
    }
    else if (typeof id === 'number') {
      acc.push(String(id));
    }
    return acc;
  }, []);

  const bb = geojson_backward.features.reduce((acc, g) => {
    const id = g.properties.ID;
    if (typeof id === 'string') {
      const nums = id.split(',');
      acc = [...acc, ...nums];
    }
    else if (typeof id === 'number') {
      acc.push(String(id));
    }
    return acc;
  }, []);

  const fc = {
    type: 'FeatureCollection',
    features: ff.map(d => id_list[d])
  };

  const bc = {
    type: 'FeatureCollection',
    features: bb.map(d => id_list[d])
  };

  const raw_combined = [
    ...geojson_forward.features,
    ...geojson_backward.features
  ];
  const raw_segments = raw_combined.map(f => f.properties.ID);
  const geojson_combined = [...fc.features, ...bc.features];
  const segments = geojson_combined.map(f => f.properties.ID);
  const distance = geojson_combined.reduce((acc, feat) => {
    return acc + feat.properties[cost_field];
  }, 0);

  segments.sort((a, b) => a - b);

  const route = {
    type: 'FeatureCollection',
    features: geojson_combined
  };

  return { distance, segments, route, raw_segments };

  function* doDijkstra(
    graph,
    edge_hash,
    ref,
    current,
    cost_field,
    node_rank,
    direction,
    reverse_ref
  ) {
    const heap = new FibonacciHeap();
    const key_to_nodes = {};

    ref.prev = {}; // node to parent_node lookup
    ref.visited = {}; // node has been fully explored
    ref.dist[current] = 0;

    do {
      graph[current].forEach(node => {

        const segment_distance =
          edge_hash[`${current}|${node}`].properties[cost_field];
        const proposed_distance = ref.dist[current] + segment_distance;

        if (proposed_distance < getComparator(ref.dist[node])) {

          if (ref.dist[node] !== undefined) {
            heap.decreaseKey(key_to_nodes[node], proposed_distance);
          }
          else {
            key_to_nodes[node] = heap.insert(proposed_distance, node);
          }
          if (reverse_ref.dist[node] >= 0) {
            const path_len = proposed_distance + reverse_ref.dist[node];
            if (tentative_shortest_path > path_len) {
              tentative_shortest_path = path_len;
              tentative_shortest_node = node;
            }
          }
          ref.dist[node] = proposed_distance;
          ref.prev[node] = current;
        }

      });
      ref.visited[current] = true;

      // get lowest value from heaps
      const elem = heap.extractMinimum();

      if (elem) {
        current = elem.value;
      }
      else {
        current = '';
        return '';
      }

      yield current;

    } while (true);
  }
}
