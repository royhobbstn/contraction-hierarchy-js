const { Graph } = require('geojson-dijkstra');

Graph.prototype.contractGraph = function() {

  // initialize dijkstra shortcut/path finder
  const finder = this._createChShortcutter();

  // for constructing hierarchy, to be able to quickly determine which edges lead to a specific vertex
  this.reverse_adj = this._createReverseAdjList();

  // TODO, future, hope to avoid the below steps and instead use node.prev_edge
  // and recursively step through

  // when creating a geoJson path, to be able to quickly reference edge information by segment _id
  this.path_lookup = this._createPathLookup();

  // be able to quickly look up edge information from an _id
  this.edge_lookup = this._createEdgeIdLookup();

  const getVertexScore = (v) => {
    const shortcut_count = this._contract(v, true, finder);
    const edge_count = this.adjacency_list[v].length;
    const edge_difference = shortcut_count - edge_count;
    const contracted_neighbors = getContractedNeighborCount(v);
    return edge_difference + contracted_neighbors;
  };

  const getContractedNeighborCount = (v) => {
    return this.adjacency_list[v].reduce((acc, node) => {
      const is_contracted = this.contracted_nodes[node] ? 1 : 0;
      return acc + is_contracted;
    }, 0);
  };

  const nh = new NodeHeap({
    compare(a, b) {
      return a.score - b.score;
    }
  });

  const contraction_order_nodes = {};
  this.contracted_nodes = {};

  // create an additional node ordering
  Object.keys(this.adjacency_list).forEach(vertex => {
    const score = getVertexScore(vertex);
    const node = new OrderNode(score, vertex);
    nh.push(node);
    contraction_order_nodes[vertex] = node;
  });


  let contraction_level = 1;

  // main contraction loop
  while (nh.length > 0) {

    // recompute to make sure that first node in priority queue
    // is still best candidate to contract
    let found_lowest = false;
    let node_obj = nh.peek();
    const old_score = node_obj.score;

    do {
      const first_vertex = node_obj.id;
      const new_score = getVertexScore(first_vertex);
      if (new_score > old_score) {
        node_obj.score = new_score;
        nh.updateItem(node_obj.heapIndex);
      }
      node_obj = nh.peek();
      if (node_obj.id === first_vertex) {
        found_lowest = true;
      }
    } while (found_lowest === false);

    // lowest found, pop it off the queue and contract it
    const v = nh.pop();

    this._contract(v.id, false, finder);

    // keep a record of contraction level of each node
    this.contracted_nodes[v.id] = contraction_level;
    contraction_level++;

  }

  // remove links to lower ranked nodes
  Object.keys(this.adjacency_list).forEach(node => {
    const from_rank = this.contracted_nodes[node];
    this.adjacency_list[node] = this.adjacency_list[node].filter(
      to_coords => {
        const to_rank = this.contracted_nodes[to_coords.end];
        return from_rank < to_rank;
      }
    );
  });

  // remove links to lower ranked nodes - reverse adj list
  Object.keys(this.reverse_adj).forEach(node => {
    const from_rank = this.contracted_nodes[node];
    this.reverse_adj[node] = this.reverse_adj[node].filter(
      to_coords => {
        const to_rank = this.contracted_nodes[to_coords.end];
        return from_rank < to_rank;
      }
    );
  });

  return;

};

// this function is multi-use:  actually contract a node  OR
// with `get_count_only = true` find number of shortcuts added
// if node were to be contracted
Graph.prototype._contract = function(v, get_count_only, finder) {
  const from_connections = (this.reverse_adj[v] || []).filter(c => {
    return !this.contracted_nodes[c.end];
  });

  const to_connections = (this.adjacency_list[v] || []).filter(c => {
    return !this.contracted_nodes[c.end];
  });

  let shortcut_count = 0;

  from_connections.forEach(u => {

    let max_total = 0;

    // dist u to v
    const dist1 = u.cost;

    to_connections.forEach(w => {

      // ignore node to itself
      if (u.end === w.end) {
        return;
      }

      // dist v to w
      const dist2 = w.cost;

      const total = dist1 + dist2;

      if (total > max_total) {
        max_total = total;
      }
    });

    const path = finder.runDijkstra(
      u.end,
      null,
      v,
      max_total
    );

    to_connections.forEach(w => {
      // ignore node
      if (u.end === w.end) {
        return;
      }

      // dist v to w
      const dist2 = w.cost;
      const total = dist1 + dist2;

      const dijkstra = path.distances[w.end] || Infinity;

      // Infinity does happen - what are the consequences
      if (total < dijkstra) {

        shortcut_count++;

        if (!get_count_only) {

          const attrs = {
            _cost: total,
            _id: `${u.attributes._id},${w.attributes._id}`,
            _attrs_array: [u, w]
          };

          const s = u.end.split(',').map(d => Number(d));
          const e = w.end.split(',').map(d => Number(d));

          // todo?  does this work in directed network??
          // should it only be added one-way?
          this._addEdge(s, e, attrs, false);

          // add to reverse adj list
          const obj = {
            start: u.end,
            end: w.end,
            attributes: attrs,
            cost: total
          };

          if (this.reverse_adj[s]) {
            this.reverse_adj[s].push(obj);
          }
          else {
            this.reverse_adj[s] = [obj];
          }

          // add to pathIdLookup
          this.path_lookup[`${u.end}|${w.end}`] = attrs._id;

        }
      }
    });

  });

  return shortcut_count;
};

Graph.prototype.loadCH = function() {
  return null;
};

Graph.prototype.saveCH = function() {
  return null;
};

//
const NodeHeap = require('geojson-dijkstra/queue');


// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}

Graph.prototype._createReverseAdjList = function() {

  // create a reverse adjacency list
  const reverse_adj = {};

  Object.keys(this.adjacency_list).forEach(node => {
    this.adjacency_list[node].forEach(edge => {

      const obj = {
        end: edge.start,
        cost: edge.cost,
        // id: edge.id,
        attributes: edge.attributes
      };

      // add edge to reverse adj list
      if (!reverse_adj[edge.end]) {
        reverse_adj[edge.end] = [obj];
      }
      else {
        reverse_adj[edge.end].push(obj);
      }

    });

  });

  return reverse_adj;
};

Graph.prototype._createPathLookup = function() {

  // create an id lookup
  const path_lookup = {};

  Object.keys(this.adjacency_list).forEach(node => {
    this.adjacency_list[node].forEach(edge => {
      path_lookup[`${edge.start}|${edge.end}`] = edge.attributes._id;
    });
  });

  return path_lookup;
};

Graph.prototype._createEdgeIdLookup = function() {

  // create an edge lookup
  const edge_lookup = {};

  Object.keys(this.adjacency_list).forEach(node => {
    this.adjacency_list[node].forEach(edge => {
      edge_lookup[edge.attributes._id] = edge;
    });
  });

  return edge_lookup;
};


Graph.prototype._createChShortcutter = function() {

  const pool = createNodePool();
  const adjacency_list = this.adjacency_list;

  return {
    runDijkstra
  };

  function runDijkstra(
    start,
    end,
    vertex,
    total
  ) {

    pool.reset();

    const str_start = String(start);
    const str_end = String(end);

    const nodeState = new Map();

    const distances = {};

    var openSet = new NodeHeap({
      compare(a, b) {
        return a.dist - b.dist;
      }
    });

    let current = pool.createNewState({ id: str_start, dist: 0 });
    nodeState.set(str_start, current);
    current.opened = 1;
    distances[current.id] = 0;

    // quick exit for start === end
    if (str_start === str_end) {
      current = '';
    }

    while (current) {

      adjacency_list[current.id]
        .filter(edge => {
          // this is a modification for contraction hierarchy
          // otherwise vertex===undefined
          return edge.end !== vertex;
        })
        .forEach(edge => {

          let node = nodeState.get(edge.end);
          if (node === undefined) {
            node = pool.createNewState({ id: edge.end });
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
        });

      current.visited = true;
      const settled_amt = current.dist;

      // get lowest value from heap
      current = openSet.pop();

      // exit early if current node becomes end node
      if (current && (current.id === end)) {
        current = '';
      }

      // stopping condition
      if (settled_amt > total) {
        current = '';
      }
    }

    // total cost included by default
    let response = { distances };


    return response;
  }

};




function Node(node, heuristic) {
  this.id = node.id;
  this.dist = node.dist !== undefined ? node.dist : Infinity;
  this.prev = undefined;
  this.visited = undefined;
  this.opened = false; // whether has been put in queue
  this.heapIndex = -1;
  this.score = Infinity;
  this.heuristic = heuristic;
}

function createNodePool() {
  var currentInCache = 0;
  var nodeCache = [];

  return {
    createNewState: createNewState,
    reset: reset
  };

  function reset() {
    currentInCache = 0;
  }

  function createNewState(node, heuristic) {
    var cached = nodeCache[currentInCache];
    if (cached) {
      cached.id = node.id;
      cached.dist = node.dist !== undefined ? node.dist : Infinity;
      cached.prev = undefined;
      cached.visited = undefined;
      cached.opened = false;
      cached.heapIndex = -1;
      cached.score = Infinity;
      cached.heuristic = heuristic;
    }
    else {
      cached = new Node(node, heuristic);
      nodeCache[currentInCache] = cached;
    }
    currentInCache++;
    return cached;
  }

}



//// Above is Building the Contraction Hierarchy

//// Below is Running the Contraction Hierarchy

Graph.prototype.createPathfinder = function() {

  const adjacency_list = this.adjacency_list;
  const rev_adjacency_list = this.reverse_adj;
  const pool = this._createNodePool();
  // const graph = this;

  return {
    queryContractionHierarchy
  };

  function queryContractionHierarchy(
    start,
    end,
    options
  ) {

    if (!options) {
      options = {};
    }

    pool.reset();

    const str_start = String(start);
    const str_end = String(end);

    const forward_nodeState = new Map();
    const backward_nodeState = new Map();

    const forward_distances = {};
    const backward_distances = {};


    let current_start = pool.createNewState({ id: str_start, dist: 0 });
    forward_nodeState.set(str_start, current_start);
    current_start.opened = 1;
    forward_distances[current_start.id] = 0;

    let current_end = pool.createNewState({ id: str_end, dist: 0 });
    backward_nodeState.set(str_end, current_end);
    current_end.opened = 1;
    backward_distances[current_end.id] = 0;

    const searchForward = doDijkstra(
      adjacency_list,
      current_start,
      'forward',
      forward_nodeState,
      forward_distances,
      backward_nodeState,
      backward_distances
    );
    const searchBackward = doDijkstra(
      rev_adjacency_list,
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

    return result;

    // let ids;

    // if (options.ids === true || options.path === true) {
    //   ids = buildIdsCH(graph, forward_nodeState, backward_nodeState, tentative_shortest_node, tentative_shortest_path, start, end);
    // }

    // if (options.ids === true) {
    //   result = Object.assign(result, ids);
    // }

    // if (options.path === true) {
    //   const path = {} // buildGeoJsonPath(graph, ids.ids, tentative_shortest_path, start, end);
    //   result = Object.assign(result, path);
    // }

    // return result;


    function* doDijkstra(
      adj,
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
        adj[current.id].forEach(edge => {

          let node = nodeState.get(edge.end);
          if (node === undefined) {
            node = pool.createNewState({ id: edge.end });
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

};



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


exports.Graph = Graph;
