//

const NodeHeap = require('../geojson-dijkstra/queue.js');


exports.queryContractionHierarchy = queryContractionHierarchy;

function queryContractionHierarchy(
  graph,
  start,
  end
) {

  graph.pool.reset();

  const str_start = String(start);
  const str_end = String(end);

  const forward_nodeState = new Map();
  const backward_nodeState = new Map();

  const forward_distances = {};
  const backward_distances = {};


  let current_start = graph.pool.createNewState({ id: str_start, dist: 0 });
  forward_nodeState.set(str_start, current_start);
  current_start.opened = 1;
  forward_distances[current_start.id] = 0;

  let current_end = graph.pool.createNewState({ id: str_end, dist: 0 });
  backward_nodeState.set(str_end, current_end);
  current_end.opened = 1;
  backward_distances[current_end.id] = 0;

  const searchForward = doDijkstra(
    current_start,
    'forward',
    forward_nodeState,
    forward_distances,
    backward_nodeState,
    backward_distances
  );
  const searchBackward = doDijkstra(
    current_end,
    'backward',
    backward_nodeState,
    backward_distances,
    forward_nodeState,
    forward_distances
  );

  let forward_done = false;
  let backward_done = false;
  let sf, sb;

  let tentative_shortest_path = Infinity;
  let tentative_shortest_node = null;

  if (str_start !== str_end) {
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
      forward_distances[sf.value.id] < tentative_shortest_path ||
      backward_distances[sb.value.id] < tentative_shortest_path
    );
  }
  else {
    tentative_shortest_path = 0;
  }

  // const geojson_forward = toBestRoute(
  //   tentative_shortest_node,
  //   forward.prev
  // );
  // const geojson_backward = toBestRoute(
  //   tentative_shortest_node,
  //   backward.prev
  // );

  // const ff = geojson_forward.features.reduce((acc, g) => {
  //   const id = g.properties.ID;
  //   if (typeof id === 'string') {
  //     const nums = id.split(',');
  //     acc = [...acc, ...nums];
  //   }
  //   else if (typeof id === 'number') {
  //     acc.push(String(id));
  //   }
  //   return acc;
  // }, []);

  // const bb = geojson_backward.features.reduce((acc, g) => {
  //   const id = g.properties.ID;
  //   if (typeof id === 'string') {
  //     const nums = id.split(',');
  //     acc = [...acc, ...nums];
  //   }
  //   else if (typeof id === 'number') {
  //     acc.push(String(id));
  //   }
  //   return acc;
  // }, []);

  // const fc = {
  //   type: 'FeatureCollection',
  //   features: ff.map(d => id_list[d])
  // };

  // const bc = {
  //   type: 'FeatureCollection',
  //   features: bb.map(d => id_list[d])
  // };

  // const raw_combined = [
  //   ...geojson_forward.features,
  //   ...geojson_backward.features
  // ];
  // const raw_segments = raw_combined.map(f => f.properties.ID);
  // const geojson_combined = [...fc.features, ...bc.features];
  // const segments = geojson_combined.map(f => f.properties.ID);
  // const distance = geojson_combined.reduce((acc, feat) => {
  //   return acc + feat.properties[cost_field];
  // }, 0);

  // segments.sort((a, b) => a - b);

  // const route = {
  //   type: 'FeatureCollection',
  //   features: geojson_combined
  // };

  return { distance: tentative_shortest_path /*, segments, route, raw_segments */ };

  function* doDijkstra(
    current,
    direction,
    nodeState,
    distances,
    reverse_nodeState,
    reverse_distances
  ) {

    var openSet = new NodeHeap(null, { rank: 'dist' });

    do {

      graph.adjacency_list[current.id].forEach(edge => {

        let node = nodeState.get(edge.end);
        if (node === undefined) {
          node = graph.pool.createNewState({ id: edge.end });
          nodeState.set(edge.end, node);
        }

        if (node.visited === true) {
          return;
        }

        if (!node.opened) {
          openSet.push(node);
          node.opened = true;
        }

        const proposed_distance = current.dist + edge.cost;
        if (proposed_distance >= node.dist) {
          return;
        }

        node.dist = proposed_distance;
        distances[node.id] = proposed_distance;
        node.prev = current.id;

        openSet.updateItem(node.heapIndex);

        const reverse_dist = reverse_distances[edge.end];
        if (reverse_dist >= 0) {
          const path_len = proposed_distance + reverse_dist;
          if (tentative_shortest_path > path_len) {
            tentative_shortest_path = path_len;
            tentative_shortest_node = edge.end;
          }
        }

      });
      current.visited = true;

      // get lowest value from heap
      current = openSet.pop();

      if (!current) {
        return '';
      }

      yield current;

    } while (true);
  }
}
