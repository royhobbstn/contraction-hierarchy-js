//

const NodeHeap = require('./queue.js');


exports.queryContractionHierarchy = queryContractionHierarchy;

function queryContractionHierarchy(
  graph,
  start,
  end,
  options
) {

  if (!options) {
    options = {};
  }

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

  let result = { distance: tentative_shortest_path !== Infinity ? tentative_shortest_path : 0 };

  let ids;

  if (options.ids === true || options.path === true) {
    ids = buildIdsCH(graph, forward_nodeState, backward_nodeState, tentative_shortest_node, tentative_shortest_path, start, end);
  }

  if (options.ids === true) {
    result = Object.assign(result, ids);
  }

  if (options.path === true) {
    const path = buildGeoJsonPath(graph, ids.ids, tentative_shortest_path, start, end);
    result = Object.assign(result, path);
  }

  return result;


  function* doDijkstra(
    current,
    direction,
    nodeState,
    distances,
    reverse_nodeState,
    reverse_distances
  ) {

    var openSet = new NodeHeap({
      compare(a, b) {
        return a.dist - b.dist;
      }
    });

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

function buildGeoJsonPath(graph, ids, tentative_shortest_path, start, end) {

  let path = {
    type: 'FeatureCollection',
    features: []
  };

  if (start === end || tentative_shortest_path === Infinity) {
    return { path };
  }

  path = {
    type: 'FeatureCollection',
    features: ids.map(id => {
      const edge = graph.edge_lookup[id];
      const feat = {
        "type": "Feature",
        "properties": edge.attributes,
        "geometry": {
          "type": "LineString",
          "coordinates": edge.geometry
        }
      };
      console.log(JSON.stringify(feat));
      return feat;
    })
  };

  return { path };
}

function buildIdsCH(graph, forward_nodeState, backward_nodeState, tentative_shortest_node, tentative_shortest_path, start, end) {

  const ids = [];

  if (start === end || tentative_shortest_path === Infinity) {
    return { ids };
  }

  let forward_path = forward_nodeState.get(tentative_shortest_node);

  while (forward_path && forward_path.prev) {
    const feature_ids = graph.path_lookup[`${forward_path.prev}|${forward_path.id}`];
    if (typeof feature_ids === 'string') {
      // a CH edge
      ids.push(...feature_ids.split(',').map(d => Number(d)));
    }
    else {
      // regular network edge
      ids.push(feature_ids);
    }
    forward_path = forward_nodeState.get(forward_path.prev);
  }

  ids.reverse();

  let backward_path = backward_nodeState.get(tentative_shortest_node);

  while (backward_path && backward_path.prev) {
    const feature_ids = graph.path_lookup[`${backward_path.id}|${backward_path.prev}`];
    if (typeof feature_ids === 'string') {
      // a CH edge
      ids.push(...feature_ids.split(',').map(d => Number(d)));
    }
    else {
      // regular network edge
      ids.push(feature_ids);
    }
    backward_path = backward_nodeState.get(backward_path.prev);
  }

  return { ids };
}
