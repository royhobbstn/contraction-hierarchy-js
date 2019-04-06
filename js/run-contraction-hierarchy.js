//

const fs = require('fs');
const { toBestRoute, getComparator } = require('./common.js');
const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;

var readlineSync = require('readline-sync');


const debug = false;
const save_output = false;

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

  if (save_output) {
    fs.writeFileSync(
      '../output/ch-forward-path.geojson',
      JSON.stringify(fc),
      'utf8'
    );
    fs.writeFileSync(
      '../output/ch-backward-path.geojson',
      JSON.stringify(bc),
      'utf8'
    );

    const forward_visited_pts = Object.keys(forward.dist).map(key => {
      const coords = key.split(',').map(d => Number(d));
      return {
        type: 'Feature',
        properties: { dist: forward.dist[key] },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      };
    });

    const backward_visited_pts = Object.keys(backward.dist).map(key => {
      const coords = key.split(',').map(d => Number(d));
      return {
        type: 'Feature',
        properties: { dist: backward.dist[key] },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      };
    });

    const forward_visited_pts_collection = {
      type: 'FeatureCollection',
      features: forward_visited_pts
    };

    const backward_visited_pts_collection = {
      type: 'FeatureCollection',
      features: backward_visited_pts
    };

    fs.writeFileSync(
      '../output/ch-forward_visited_pts.geojson',
      JSON.stringify(forward_visited_pts_collection),
      'utf8'
    );
    fs.writeFileSync(
      '../output/ch-backward_visited_pts.geojson',
      JSON.stringify(backward_visited_pts_collection),
      'utf8'
    );

    // settled nodes visualization

    const forward_settled_pts = Object.keys(forward.visited).map(key => {
      const coords = key.split(',').map(d => Number(d));
      return {
        type: 'Feature',
        properties: { dist: forward.dist[key] },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      };
    });

    const backward_settled_pts = Object.keys(backward.visited).map(key => {
      const coords = key.split(',').map(d => Number(d));
      return {
        type: 'Feature',
        properties: { dist: backward.dist[key] },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      };
    });

    const forward_settled_pts_collection = {
      type: 'FeatureCollection',
      features: forward_settled_pts
    };

    const backward_settled_pts_collection = {
      type: 'FeatureCollection',
      features: backward_settled_pts
    };

    fs.writeFileSync(
      '../output/ch-forward_settled_pts.geojson',
      JSON.stringify(forward_settled_pts_collection),
      'utf8'
    );
    fs.writeFileSync(
      '../output/ch-backward_settled_pts.geojson',
      JSON.stringify(backward_settled_pts_collection),
      'utf8'
    );
  }

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
      const current_rank = node_rank[current];

      if (debug) {
        console.log('');
        console.log('');
        console.log(`starting new ${direction.toUpperCase()} loop`);
        // console.log({current, current_rank});
        console.time('bi-di-ch');
        console.log('edge count:', graph[current].length);
        console.log('for each edge from current node:');
        console.log('');
      }

      graph[current].forEach(node => {
        if (debug) {
          console.log('processing edge:', { node, current_rank, node_rank: node_rank[node] });
        }

        const segment_distance =
          edge_hash[`${current}|${node}`].properties[cost_field];
        const proposed_distance = ref.dist[current] + segment_distance;

        if (debug) {
          console.log(
            'the distance to the current node is: ',
            ref.dist[current]
          );
          console.log(
            `edge has an id of: ${
              edge_hash[`${current}|${node}`].properties.ID
            }`
          );
          console.log('edge has cost of :', { segment_distance });
          console.log('so the distance to the end of the edge would be:', {
            proposed_distance
          });
          console.log(
            'the current estimated distance to the end of the edge via another path is: ',
            ref.dist[node]
          );
        }

        if (proposed_distance < getComparator(ref.dist[node])) {
          if (debug) {
            console.log('the new route is smaller!');
            console.log('');
          }
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
        else {
          if (debug) {
            console.log('but the new route was not smaller');
            console.log('');
          }
        }
      });
      ref.visited[current] = true;

      // get lowest value from heaps
      const elem = heap.extractMinimum();

      if (elem) {
        current = elem.value;
        if (debug) {
          console.log(
            `next on heap,   key: ${elem.key}  value: ${elem.value}  rank: ${
              node_rank[elem.value]
            }`
          );
        }
      }
      else {
        current = '';
        return '';
      }

      if (debug) {
        console.log('end of loop');
        console.log('heap size', heap.size());
        console.timeEnd('bi-di-ch');
        console.log('------');
      }

      // var userName = readlineSync.question('May I have your name? ');
      

      yield current;
    } while (true);
  }
}
