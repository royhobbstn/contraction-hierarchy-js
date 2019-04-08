//
const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;

const { getComparator } = require('./common.js');

exports.runDijkstra = runDijkstra;
exports.toGraph = toGraph;

function runDijkstra(graph, start, end) {

  start = graph.lookup[start];
  end = graph.lookup[end];

  if (!start || !end) {
    throw new Error('origin or destination does not exist on graph');
  }

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
  dist[current] = 0;

  do {
    graph.adjacency_list[current]
      .forEach(n => {
        const node = n.end;

        // this optimization may not hold true for directed graphs
        if (visited[node]) {
          return;
        }

        const segment_distance = n.cost;
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

  const route = reconstructRoute(end, prev, graph);

  return route;
}

function reconstructRoute(end, prev, graph) {

  const features = [];
  const segments = [];
  let distance = 0;

  while (prev[end]) {
    const lookup_index = graph.paths[`${end}|${prev[end]}`].lookup_index;
    const properties = graph.properties[lookup_index];
    const feature = {
      "type": "Feature",
      "properties": properties,
      "geometry": {
        "type": "LineString",
        "coordinates": graph.geometry[lookup_index]
      }
    };
    features.push(feature);
    distance += properties._cost;
    segments.push(properties.ID);
    end = prev[end];
  }

  const route = {
    type: 'FeatureCollection',
    features: features
  };

  return { route, distance, segments };

}

function toGraph(geo) {
  const features = Array.isArray(geo) ? geo : geo.features;

  // map to one unique edge.  edge can reference geometry with a reverse flag
  const adjacency_list = {};
  const geometry = [];
  const properties = [];
  const paths = {};

  let incrementor = 0;
  const lookup = {};

  features.forEach((feature, index) => {
    const coordinates = feature.geometry.coordinates;

    if (!feature.properties || !coordinates || !feature.properties._cost) {
      console.log('invalid feature detected.  skipping...');
      return;
    }

    geometry[index] = coordinates;
    properties[index] = feature.properties;

    const start_vertex = coordinates[0].join(',');
    const end_vertex = coordinates[coordinates.length - 1].join(',');

    let start_id;

    if (!lookup[start_vertex]) {
      incrementor++;
      lookup[start_vertex] = incrementor;
      start_id = incrementor;
    }
    else {
      start_id = lookup[start_vertex];
    }

    let end_id;

    if (!lookup[end_vertex]) {
      incrementor++;
      lookup[end_vertex] = incrementor;
      end_id = incrementor;
    }
    else {
      end_id = lookup[end_vertex];
    }

    // forward path
    if (feature.properties._direction === 'f' || feature.properties._direction === 'all' || !feature.properties._direction) {

      const forward_cost = feature.properties._forward_cost || feature.properties._cost;

      const edge_obj = {
        start: start_id,
        end: end_id,
        cost: forward_cost,
        lookup_index: index,
        reverse_flag: false
      };

      const proposed_path = paths[`${start_id}|${end_id}`];
      if (!proposed_path) {
        // guard against identical longer edge
        paths[`${start_id}|${end_id}`] = edge_obj;
      }
      else if (forward_cost < proposed_path.cost) {
        paths[`${start_id}|${end_id}`] = edge_obj;
      }

      if (!adjacency_list[start_id]) {
        adjacency_list[start_id] = [edge_obj];
      }
      else {
        adjacency_list[start_id].push(edge_obj);
      }

    }

    // reverse path
    if (feature.properties._direction === 'b' || feature.properties._direction === 'all' || !feature.properties._direction) {

      const reverse_cost = feature.properties._backward_cost || feature.properties._cost;

      const edge_obj_reverse = {
        start: end_id,
        end: start_id,
        cost: reverse_cost,
        lookup_index: index,
        reverse_flag: true
      };

      const proposed_path = paths[`${end_id}|${start_id}`];
      if (!proposed_path) {
        // guard against identical longer edge
        paths[`${end_id}|${start_id}`] = edge_obj_reverse;
      }
      else if (reverse_cost < proposed_path.cost) {
        paths[`${end_id}|${start_id}`] = edge_obj_reverse;
      }

      if (!adjacency_list[end_id]) {
        adjacency_list[end_id] = [edge_obj_reverse];
      }
      else {
        adjacency_list[end_id].push(edge_obj_reverse);
      }

    }


  });

  return { adjacency_list, properties, geometry, lookup, paths };
}
