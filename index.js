//
const NodeHeap = require('./queue.js');

// objects
exports.Graph = Graph;


function Graph(geojson) {
  this.adjacency_list = [];
  this._createNodePool = createNodePool;

  this._coordsIndex = -1;
  this._strCoordsToIndex = {};
  this._indexToStrCoords = []; // todo may not ever be needed

  this._propertiesIndex = -1;
  this._properties = [];
  this._geometry = [];

  if (geojson) {
    this.loadFromGeoJson(geojson);
    // this.contract??
  }
}


Graph.prototype._addEdge = function(startNode, endNode, properties, geometry, isUndirected, lateAdd) {

  let start_index;
  let end_index;

  if (!lateAdd) {
    // input can now be String or Number coordinates (or anything!) makes no difference
    const start_node = String(startNode);
    const end_node = String(endNode);

    if (start_node === end_node) {
      console.log("Start and End Nodes are the same.  Ignoring.");
      return;
    }

    if (this._strCoordsToIndex[start_node] == null) {
      this._coordsIndex++;
      this._strCoordsToIndex[start_node] = this._coordsIndex;
      this._indexToStrCoords[this._coordsIndex] = start_node;
    }
    if (this._strCoordsToIndex[end_node] == null) {
      this._coordsIndex++;
      this._strCoordsToIndex[end_node] = this._coordsIndex;
      this._indexToStrCoords[this._coordsIndex] = end_node;
    }

    start_index = this._strCoordsToIndex[start_node];
    end_index = this._strCoordsToIndex[end_node];
  }
  else {
    start_index = startNode;
    end_index = endNode;
  }

  this._propertiesIndex++;
  this._properties[this._propertiesIndex] = properties;
  this._geometry[this._propertiesIndex] = geometry;

  // create object to push into adjacency list
  const obj = {
    end: end_index,
    cost: properties._forward_cost || properties._cost,
    attrs: this._propertiesIndex
  };

  if (this.adjacency_list[start_index]) {
    this.adjacency_list[start_index].push(obj);
  }
  else {
    this.adjacency_list[start_index] = [obj];
  }

  // add reverse path
  if (isUndirected) {

    const reverse_obj = {
      end: start_index,
      cost: properties._backward_cost || properties._cost,
      attrs: this._propertiesIndex
    };

    if (this.adjacency_list[end_index]) {
      this.adjacency_list[end_index].push(reverse_obj);
    }
    else {
      this.adjacency_list[end_index] = [reverse_obj];
    }

  }

  return this._propertiesIndex;

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


Graph.prototype.loadFromGeoJson = function(geo) {

  // cleans geojson (mutates in place)
  const features = this._cleanseGeoJsonNetwork(geo);

  features.forEach(feature => {
    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties;

    if (!properties || !coordinates || !properties._cost) {
      console.log('invalid feature detected.  skipping...');
      return;
    }

    const start_vertex = coordinates[0];
    const end_vertex = coordinates[coordinates.length - 1];

    if (feature.properties._direction === 'f') {
      this._addEdge(start_vertex, end_vertex, properties, coordinates, false, false);
    }
    else {
      this._addEdge(start_vertex, end_vertex, properties, coordinates, true, false);
    }

  });

};


Graph.prototype._cleanseGeoJsonNetwork = function(file) {

  // get rid of duplicate edges (same origin to dest)
  const inventory = {};

  const features = file.features;

  features.forEach(feature => {
    const start = feature.geometry.coordinates[0].join(',');
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1].join(',');
    const id = `${start}|${end}`;

    const reverse_id = `${end}|${start}`;

    if (!feature.properties._direction || feature.properties._direction === 'all' || feature.properties._direction === 'f') {

      if (!inventory[id]) {
        // new segment
        inventory[id] = feature;
      }
      else {
        // a segment with the same origin/dest exists.  choose shortest.
        const old_cost = inventory[id].properties._cost;
        const new_cost = feature.properties._forward_cost || feature.properties._cost;
        if (new_cost < old_cost) {
          // mark old segment for deletion
          inventory[id].properties.__markDelete = true;
          // rewrite old segment because this one is shorter
          inventory[id] = feature;
        }
        else {
          // instead mark new feature for deletion
          feature.properties.__markDelete = true;
        }
      }

    }

    if (!feature.properties._direction || feature.properties._direction === 'all' || feature.properties._direction === 'b') {
      // now reverse
      if (!inventory[reverse_id]) {
        // new segment
        inventory[reverse_id] = feature;
      }
      else {
        // a segment with the same origin/dest exists.  choose shortest.
        const old_cost = inventory[reverse_id].properties._cost;
        const new_cost = feature.properties._backward_cost || feature.properties._cost;
        if (new_cost < old_cost) {
          // mark old segment for deletion
          inventory[reverse_id].properties.__markDelete = true;
          // rewrite old segment because this one is shorter
          inventory[reverse_id] = feature;
        }
        else {
          // instead mark new feature for deletion
          feature.properties.__markDelete = true;
        }
      }
    }

  });

  // filter out marked items
  return features.filter(feature => {
    return !feature.properties.__markDelete;
  });

};

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

function noOp() {
  return 0;
}


Graph.prototype.createFinder = function(opts) {

  const options = opts || {};
  const parseOutputFns = options.parseOutputFns || [];
  const heuristicFn = options.heuristic || noOp;
  const pool = this._createNodePool();
  const adjacency_list = this.adjacency_list;
  const strCoordsToIndex = this._strCoordsToIndex;

  return {
    findPath
  };

  function findPath(start, end) {

    pool.reset();

    const start_index = strCoordsToIndex[String(start)];
    const end_index = strCoordsToIndex[String(end)];

    const nodeState = [];

    var openSet = new NodeHeap({
      compare(a, b) {
        return a.score - b.score;
      }
    });

    let current = pool.createNewState({ id: start_index, dist: 0 }, heuristicFn(start, end));
    nodeState[start_index] = current;
    current.opened = 1;

    // quick exit for start === end	
    if (start_index === end_index) {
      current = '';
    }

    while (current) {

      adjacency_list[current.id]
        .forEach(edge => {

          let node = nodeState[edge.end];
          if (node === undefined) {
            node = pool.createNewState({ id: edge.end }, heuristicFn([edge.end_lng, edge.end_lat], end));
            nodeState[edge.end] = node;
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
            // longer path	
            return;
          }

          node.dist = proposed_distance;
          node.prev = edge;
          node.score = proposed_distance + node.heuristic;

          openSet.updateItem(node.heapIndex);
        });

      current.visited = true;

      // get lowest value from heap	
      current = openSet.pop();

      if (!current) {
        // there is no path.  distance will be set to 0	
        break;
      }

      // exit early if current node becomes end node	
      if (current.id === end_index) {
        current = '';
      }
    }

    // total cost included by default	
    const last_node = nodeState[end_index];
    let response = { total_cost: (last_node && last_node.dist) || 0 };

    // if no output fns specified	
    if (!parseOutputFns) {
      return response;
    }

    // one callback function	
    if (!Array.isArray(parseOutputFns)) {
      return Object.assign({}, response, parseOutputFns(this, nodeState, start_index, end_index));
    }

    // array of callback functions	
    parseOutputFns.forEach(fn => {
      response = Object.assign({}, response, fn(this, nodeState, start_index, end_index));
    });

    return response;
  }
};




// Start CH specific

Graph.prototype.contractGraph = function() {

  // initialize dijkstra shortcut/path finder
  const finder = this._createChShortcutter();

  // for constructing hierarchy, to be able to quickly determine which edges lead to a specific vertex
  this.reverse_adj = this._createReverseAdjList();

  // TODO, future, hope to avoid the below steps and instead use node.prev_edge
  // and recursively step through

  // when creating a geoJson path, to be able to quickly reference edge information by segment _id
  // this.path_lookup = this._createPathLookup();

  // be able to quickly look up edge information from an _id
  // this.edge_lookup = this._createEdgeIdLookup();

  const getVertexScore = (v) => {
    const shortcut_count = this._contract(v, true, finder); /**/
    const edge_count = this.adjacency_list[v].length;
    const edge_difference = shortcut_count - edge_count;
    const contracted_neighbors = getContractedNeighborCount(v);
    return edge_difference + contracted_neighbors;
  };

  const getContractedNeighborCount = (v) => {
    return this.adjacency_list[v].reduce((acc, node) => {
      const is_contracted = this.contracted_nodes[node.end] ? 1 : 0;
      return acc + is_contracted;
    }, 0);
  };

  const nh = new NodeHeap({
    compare(a, b) {
      return a.score - b.score;
    }
  });

  this.contracted_nodes = [];

  // create an additional node ordering
  this.adjacency_list.forEach((vertex, index) => {
    const score = getVertexScore(index);
    const node = new OrderNode(score, index);
    nh.push(node);
  });

  // OK TO HERE

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

    this._contract(v.id, false, finder); /**/

    // keep a record of contraction level of each node
    this.contracted_nodes[v.id] = contraction_level;
    contraction_level++;

  }

  this._cleanAdjList();

  return;

};

Graph.prototype._cleanAdjList = function() {

  // remove links to lower ranked nodes
  this.adjacency_list.forEach((node, index) => {
    const from_rank = this.contracted_nodes[index];
    if (!from_rank) {
      return;
    }
    this.adjacency_list[index] = this.adjacency_list[index].filter(
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
  this.reverse_adj.forEach((node, index) => {
    const from_rank = this.contracted_nodes[index];
    if (!from_rank) {
      return;
    }
    this.reverse_adj[index] = this.reverse_adj[index].filter(
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
            _id: `${u.attrs},${w.attrs}`
          };

          // const s = u.end.split(',').map(d => Number(d));
          // const e = w.end.split(',').map(d => Number(d));

          // todo?  does this work in directed network??
          // should it only be added one-way?

          // somehow get node of start and end???

          const attrs_index = this._addEdge(u.end, w.end, attrs, null, false, true);

          // todo THIS IS suspicious for these reasons:
          // start and end maybe should be switched
          // cost is not taking forward/backward into account
          // but this is what it was originally in the working
          // version so SHRUG for now

          // add to reverse adj list
          const obj = {
            end: w.end,
            cost: total,
            attrs: attrs_index
          };

          if (this.reverse_adj[u.end]) {
            this.reverse_adj[u.end].push(obj);
          }
          else {
            this.reverse_adj[u.end] = [obj];
          }

          // add to pathIdLookup
          // this.path_lookup[`${u.end}|${w.end}`] = attrs._id;
          // this.path_lookup[`${w.end}|${u.end}`] = attrs._id;
        }
      }
    });

  });

  return shortcut_count;
};

Graph.prototype.loadCH = function(ch) {
  const parsed = JSON.parse(ch);
  this.adjacency_list = parsed.adjacency_list;
  this.reverse_adj = parsed.reverse_adj; // TODO just create on demand rather than save
  // this.path_lookup = parsed.path_lookup;
  // this.edge_lookup = parsed.edge_lookup;
  // this.contracted_nodes = parsed.contracted_nodes;

  // TODO function call to create a reverse adj list
};

Graph.prototype.saveCH = function() {
  // TODO more selective
  return JSON.stringify(this);
};


// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}

Graph.prototype._createReverseAdjList = function() {

  // create a reverse adjacency list
  const reverse_adj = [];

  this.adjacency_list.forEach((node, index) => {
    node.forEach(edge => {

      const obj = {
        end: index,
        cost: edge.cost,
        attrs: edge.attrs
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
    start_index,
    end_index,
    vertex,
    total
  ) {

    pool.reset();

    const nodeState = [];
    const distances = {};

    var openSet = new NodeHeap({
      compare(a, b) {
        return a.dist - b.dist;
      }
    });

    let current = pool.createNewState({ id: start_index, dist: 0 });
    nodeState[start_index] = current;
    current.opened = 1;
    distances[current.id] = 0;

    // quick exit for start === end	
    if (start_index === end_index) {
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

          let node = nodeState[edge.end];
          if (node === undefined) {
            node = pool.createNewState({ id: edge.end });
            nodeState[edge.end] = node;
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
      if (current && (current.id === end_index)) {
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
  const rev_adjacency_list = this.reverse_adj; // todo or build it
  const pool = this._createNodePool();
  const strCoordsToIndex = this._strCoordsToIndex;

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

    const start_index = strCoordsToIndex[String(start)];
    const end_index = strCoordsToIndex[String(end)];

    const forward_nodeState = [];
    const backward_nodeState = [];

    const forward_distances = {};
    const backward_distances = {};


    let current_start = pool.createNewState({ id: start_index, dist: 0 });
    forward_nodeState[start_index] = current_start;
    current_start.opened = 1;
    forward_distances[current_start.id] = 0;

    let current_end = pool.createNewState({ id: end_index, dist: 0 });
    backward_nodeState[end_index] = current_end;
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

    if (start_index !== end_index) {
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
      ids = buildIdsCH(graph, forward_nodeState, backward_nodeState, tentative_shortest_node, tentative_shortest_path, start_index, end_index);
    }

    if (options.ids === true) {
      result = Object.assign(result, ids);
    }

    if (options.path === true) {
      const path = buildGeoJsonPath(graph, ids.ids, tentative_shortest_path, start_index, end_index);
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

          let node = nodeState[edge.end];
          if (node === undefined) {
            node = pool.createNewState({ id: edge.end });
            nodeState[edge.end] = node;
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
