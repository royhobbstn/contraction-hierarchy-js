const { Graph, CoordinateLookup } = require('geojson-dijkstra');

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

  this.contracted_nodes = {};

  // create an additional node ordering
  Object.keys(this.adjacency_list).forEach(vertex => {
    const score = getVertexScore(vertex);
    const node = new OrderNode(score, vertex);
    nh.push(node);
  });


  let contraction_level = 1;

  const len = nh.length;

  // main contraction loop
  while (nh.length > 0) {

    const updated_len = nh.length;

    if (updated_len % 1000 === 0) {
      console.log(updated_len / len);
    }

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

  this._cleanAdjList();

  return;

};

Graph.prototype._cleanAdjList = function() {
  // remove links to lower ranked nodes
  Object.keys(this.adjacency_list).forEach(node => {
    const from_rank = this.contracted_nodes[node];
    if (!from_rank) {
      return;
    }
    this.adjacency_list[node] = this.adjacency_list[node].filter(
      to_coords => {
        const to_rank = this.contracted_nodes[to_coords.end];
        if (!to_rank) {
          return true;
        }
        return from_rank < to_rank;
      }
    );
  });

  // remove links to lower ranked nodes - reverse adj list
  Object.keys(this.reverse_adj).forEach(node => {
    const from_rank = this.contracted_nodes[node];
    if (!from_rank) {
      return;
    }
    this.reverse_adj[node] = this.reverse_adj[node].filter(
      to_coords => {
        const to_rank = this.contracted_nodes[to_coords.end];
        if (!to_rank) {
          return true;
        }
        return from_rank < to_rank;
      }
    );
  });
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
            _id: `${u.attributes._id},${w.attributes._id}`
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
          this.path_lookup[`${w.end}|${u.end}`] = attrs._id;
        }
      }
    });

  });

  return shortcut_count;
};

Graph.prototype.loadCH = function(ch) {
  const parsed = JSON.parse(ch);
  this.adjacency_list = parsed.adjacency_list;
  this.mutate_inputs = parsed.mutate_inputs;
  this.reverse_adj = parsed.reverse_adj;
  this.path_lookup = parsed.path_lookup;
  this.edge_lookup = parsed.edge_lookup;
  this.contracted_nodes = parsed.contracted_nodes;
};

Graph.prototype.saveCH = function() {
  return JSON.stringify(this);
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

  const pool = this._createNodePool();
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

    let response = { distances };

    return response;
  }

};



//// Above is Building the Contraction Hierarchy

//// Below is Running the Contraction Hierarchy

Graph.prototype.createPathfinder = function(options) {

  const adjacency_list = this.adjacency_list;
  const rev_adjacency_list = this.reverse_adj;
  const pool = this._createNodePool();
  const graph = this;

  if (!options) {
    options = {};
  }


  return {
    queryContractionHierarchy
  };

  function queryContractionHierarchy(
    start,
    end
  ) {

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

    let result = { total_cost: tentative_shortest_path !== Infinity ? tentative_shortest_path : 0 };

    let ids;

    if (options.ids === true || options.path === true) {
      ids = buildIdsCH(graph, forward_nodeState, backward_nodeState, tentative_shortest_node, tentative_shortest_path, str_start, str_end);
    }

    if (options.ids === true) {
      result = Object.assign(result, ids);
    }

    if (options.path === true) {
      const path = buildGeoJsonPath(graph, ids.ids, tentative_shortest_path, str_start, str_end);
      result = Object.assign(result, path);
    }

    return result;


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



function buildGeoJsonPath(graph, ids, tentative_shortest_path, str_start, str_end) {

  let path = {
    type: 'FeatureCollection',
    features: []
  };

  if (str_start === str_end || tentative_shortest_path === Infinity) {
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

  return { path: detangle(path) };
}

function buildIdsCH(graph, forward_nodeState, backward_nodeState, tentative_shortest_node, tentative_shortest_path, str_start, str_end) {

  const ids = [];

  if (str_start === str_end || tentative_shortest_path === Infinity) {
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

  const ordered_ids = orderIds(graph, ids, str_start, str_end);

  return { ids: ordered_ids };
}

function orderIds(graph, ids, str_start, str_end) {

  const links = {};

  ids.forEach(id => {
    const edge = graph.edge_lookup[id];
    if (!links[edge.start]) {
      links[edge.start] = [id];
    }
    else {
      links[edge.start].push(id);
    }

    if (!links[edge.end]) {
      links[edge.end] = [id];
    }
    else {
      links[edge.end].push(id);
    }
  });

  // { '-122.521653,45.672558': [ 10165, 10164 ],
  // '-122.552598,45.667629': [ 10165, 10166 ],
  // '-122.505768,45.672218': [ 10164, 11680 ],
  // '-122.560869,45.665279': [ 10166, 13514 ],
  // '-122.572247,45.659981': [ 13514, 13513 ],
  // '-122.577877,45.65563': [ 13513, 12027 ],
  // '-122.400266,45.587041': [ 11716, 11721 ],
  // '-122.407011,45.604287': [ 11716, 11680 ],
  // '-122.368245,45.583623': [ 11721 ],
  // '-122.6009,45.644779': [ 12027, 10404 ],
  // '-122.601984,45.626598': [ 10404 ] }

  const ordered = [];

  // first segment
  let pt = str_start;
  let link_id = links[pt][0]; // first pt points to array with a single item
  ordered.push(link_id);
  let segment_details = graph.edge_lookup[link_id];

  do {
    const link_start = segment_details.start;
    const link_end = segment_details.end;
    const next_pt = pt === link_start ? link_end : link_start;
    const matched_ids = links[next_pt];
    if (matched_ids.length === 1) {
      // end pt found
      break;
    }
    link_id = link_id === matched_ids[0] ? matched_ids[1] : matched_ids[0];
    ordered.push(link_id);
    segment_details = graph.edge_lookup[link_id];
    pt = next_pt;
  } while (true);

  return ordered;

}



// todo duplicated
function detangle(geo) {

  // ------ de-tangle routine

  // copy source to avoid mutation
  const features = JSON.parse(JSON.stringify(geo)).features;

  const collection = {
    type: "FeatureCollection",
    features: features
  };

  // if only one feature return
  if (features.length <= 1) {
    return collection;
  }

  // modify first feature
  const cf = features[0];
  const nf = features[1];

  const ce = cf.geometry.coordinates[cf.geometry.coordinates.length - 1];

  const ns = nf.geometry.coordinates[0];
  const ne = nf.geometry.coordinates[nf.geometry.coordinates.length - 1];

  // in case of ce !== ns && ce !== ne. (flip first feature)

  // ce === ns
  const ce_ns = ce[0] === ns[0] && ce[1] === ns[1];
  // ce === ne
  const ce_ne = ce[0] === ne[0] && ce[1] === ne[1];

  if (!ce_ns && !ce_ne) {
    features[0].geometry.coordinates.reverse();
  }

  // modify rest of the features to match orientation of the first
  for (let i = 1; i < features.length; i++) {
    const lastFeature = features[i - 1];
    const currentFeature = features[i];

    const last_end = lastFeature.geometry.coordinates[lastFeature.geometry.coordinates.length - 1];
    const current_end = currentFeature.geometry.coordinates[currentFeature.geometry.coordinates.length - 1];

    // in the case of last_end == current_end  (flip this)
    const le_ce = last_end[0] === current_end[0] && last_end[1] === current_end[1];

    if (le_ce) {
      currentFeature.geometry.coordinates.reverse();
    }

  }

  return collection;
}



exports.Graph = Graph;
exports.CoordinateLookup = CoordinateLookup;
