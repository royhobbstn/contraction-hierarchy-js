//

const fs = require('fs').promises;
const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;
const { toBestRoute, getComparator } = require('./common.js');

const debug = false;
const save_output = false;

exports.runBiDijkstra = runBiDijkstra;

function runBiDijkstra(adj_list, edge_hash, start, end, cost_field) {
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
  const backward = {};
  backward.dist = {};

  const searchForward = doDijkstra(
    adj_list,
    edge_hash,
    forward,
    start,
    cost_field,
    'forward',
    backward
  );
  const searchBackward = doDijkstra(
    adj_list,
    edge_hash,
    backward,
    end,
    cost_field,
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
    forward.dist[sf.value] + backward.dist[sb.value] <
    tentative_shortest_path
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

  if (save_output) {
    console.log('forward');
    geojson_forward.features.forEach(g => {
      console.log(g.properties.ID, g.properties[cost_field]);
    });
    console.log('backward');
    geojson_backward.features.forEach(g => {
      console.log(g.properties.ID, g.properties[cost_field]);
    });

    fs.writeFile(
      './orig_path1.geojson',
      JSON.stringify(geojson_forward),
      'utf8'
    );
    fs.writeFile(
      './orig_path2.geojson',
      JSON.stringify(geojson_backward),
      'utf8'
    );

    const fr = Object.keys(forward.visited).map(key => {
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

    const br = Object.keys(backward.visited).map(key => {
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

    const fradius = {
      type: 'FeatureCollection',
      features: fr
    };
    const bradius = {
      type: 'FeatureCollection',
      features: br
    };

    fs.writeFile(
      './bidi_forward_radius.geojson',
      JSON.stringify(fradius),
      'utf8'
    );
    fs.writeFile(
      './bidi_backward_radius.geojson',
      JSON.stringify(bradius),
      'utf8'
    );
  }

  const geojson_combined = [
    ...geojson_forward.features,
    ...geojson_backward.features
  ];
  const segments = geojson_combined.map(f => f.properties.ID);
  const distance = geojson_combined.reduce((acc, feat) => {
    return acc + feat.properties[cost_field];
  }, 0);

  segments.sort((a, b) => a - b);

  const route = {
    type: 'FeatureCollection',
    features: geojson_combined
  };

  return { distance, segments, route };

  function* doDijkstra(
    graph,
    edge_hash,
    ref,
    current,
    cost_field,
    direction,
    reverse_ref
  ) {
    const heap = new FibonacciHeap();
    const key_to_nodes = {};

    ref.prev = {}; // node to parent_node lookup
    ref.visited = {}; // node has been fully explored
    ref.dist[current] = 0;

    do {
      if (debug) {
        console.log(direction);
        console.log({ current });
      }

      graph[current].forEach(node => {
        // this optimization may not hold true for directed graphs
        if (ref.visited[node]) {
          return;
        }

        const segment_distance =
          edge_hash[`${current}|${node}`].properties[cost_field];
        const proposed_distance = ref.dist[current] + segment_distance;

        if (proposed_distance < getComparator(ref.dist[node])) {
          if (ref.dist[node] !== undefined) {
            heap.decreaseKey(key_to_nodes[node], proposed_distance);
          } else {
            key_to_nodes[node] = heap.insert(proposed_distance, node);
          }
          // check here for new complete paths
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

      if (debug) {
        if (tentative_shortest_path !== Infinity) {
          console.log(direction, elem.key, elem.value);
        }
      }

      current = elem.value;

      yield current;
    } while (true);
  }
}
