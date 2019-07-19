const NodeHeap = require('./queue.js');
const clone = require('@turf/clone').default;
const buildIdList = require('./buildOutputs.js').buildIdList;
const CoordinateLookup = require('./coordinate-lookup.js').CoordinateLookup;

// objects
exports.Graph = Graph;
exports.CoordinateLookup = CoordinateLookup;

function Graph(geojson, opt) {
  const options = opt || {};
  this.debugMode = options.debugMode || false;

  this.adjacency_list = [];
  this.reverse_adjacency_list = [];

  this._createNodePool = createNodePool;

  this._nodesIndex = -1;
  this._nodeToIndex = {};

  this._edgeIndex = -1;
  this._properties = [];
  this._geometry = [];
  this._maxEdgeID = 0;

  this._locked = false; // locked if contraction has already been run

  if (geojson) {
    this.loadFromGeoJson(geojson);
  }
}


Graph.prototype.addEdge = function(start_node, end_node, edge_properties, edge_geometry) {

  if (this._locked) {
    console.log('Graph has been contracted.  No additional edges can be added.');
    return;
  }

  if (start_node === end_node) {
    if (this.debugMode) {
      console.log("Start and End Nodes are the same.  Ignoring.");
    }
    return;
  }

  if (this._nodeToIndex[start_node] == null) {
    this._nodesIndex++;
    this._nodeToIndex[start_node] = this._nodesIndex;
  }
  if (this._nodeToIndex[end_node] == null) {
    this._nodesIndex++;
    this._nodeToIndex[end_node] = this._nodesIndex;
  }

  let start_index = this._nodeToIndex[start_node];
  let end_index = this._nodeToIndex[end_node];

  // add to adjacency list
  this._edgeIndex++;
  this._properties[this._edgeIndex] = JSON.parse(JSON.stringify(edge_properties));
  this._properties[this._edgeIndex]._start_index = start_index;
  this._properties[this._edgeIndex]._end_index = end_index;
  this._geometry[this._edgeIndex] = edge_geometry ? JSON.parse(JSON.stringify(edge_geometry)) : null;

  // create object to push into adjacency list
  const obj = {
    end: end_index,
    cost: edge_properties._cost,
    attrs: this._edgeIndex
  };

  if (this.adjacency_list[start_index]) {
    this.adjacency_list[start_index].push(obj);
  }
  else {
    this.adjacency_list[start_index] = [obj];
  }

  // add to reverse adjacency list
  const reverse_obj = {
    end: start_index,
    cost: edge_properties._cost,
    attrs: this._edgeIndex
  };

  if (this.reverse_adjacency_list[end_index]) {
    this.reverse_adjacency_list[end_index].push(reverse_obj);
  }
  else {
    this.reverse_adjacency_list[end_index] = [reverse_obj];
  }

};


Graph.prototype._addContractedEdge = function(start_index, end_index, properties) {

  // geometry not applicable here

  this._edgeIndex++;
  this._properties[this._edgeIndex] = properties;
  this._properties[this._edgeIndex]._start_index = start_index;
  this._properties[this._edgeIndex]._end_index = end_index;
  this._geometry[this._edgeIndex] = null;

  // create object to push into adjacency list
  const obj = {
    end: end_index,
    cost: properties._cost,
    attrs: this._edgeIndex
  };

  if (this.adjacency_list[start_index]) {
    this.adjacency_list[start_index].push(obj);
  }
  else {
    this.adjacency_list[start_index] = [obj];
  }

  // add it to reverse adjacency list
  const reverse_obj = {
    end: start_index,
    cost: properties._cost,
    attrs: this._edgeIndex
  };

  if (this.reverse_adjacency_list[end_index]) {
    this.reverse_adjacency_list[end_index].push(reverse_obj);
  }
  else {
    this.reverse_adjacency_list[end_index] = [reverse_obj];
  }

};


function Node(node) {
  this.id = node.id;
  this.dist = node.dist !== undefined ? node.dist : Infinity;
  this.prev = undefined;
  this.visited = undefined;
  this.opened = false; // whether has been put in queue
  this.heapIndex = -1;
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

  function createNewState(node) {
    var cached = nodeCache[currentInCache];
    if (cached) {
      cached.id = node.id;
      cached.dist = node.dist !== undefined ? node.dist : Infinity;
      cached.prev = undefined;
      cached.visited = undefined;
      cached.opened = false;
      cached.heapIndex = -1;
    }
    else {
      cached = new Node(node);
      nodeCache[currentInCache] = cached;
    }
    currentInCache++;
    return cached;
  }

}


Graph.prototype.loadFromGeoJson = function(filedata) {

  // make a copy
  const geo = clone(filedata);

  // cleans geojson (mutates in place)
  const features = this._cleanseGeoJsonNetwork(geo);

  features.forEach((feature, index) => {
    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties;

    if (!properties || !coordinates || !properties._cost) {
      if (this.debugMode) {
        console.log('invalid feature detected.  skipping...');
      }
      return;
    }

    const start_vertex = coordinates[0];
    const end_vertex = coordinates[coordinates.length - 1];

    // add forward
    this.addEdge(start_vertex, end_vertex, properties, JSON.parse(JSON.stringify(coordinates)));

    // add backward
    this.addEdge(end_vertex, start_vertex, properties, JSON.parse(JSON.stringify(coordinates)).reverse());

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


    if (!inventory[id]) {
      // new segment
      inventory[id] = feature;
    }
    else {
      // a segment with the same origin/dest exists.  choose shortest.
      const old_cost = inventory[id].properties._cost;
      const new_cost = feature.properties._cost;
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


    // now reverse
    if (!inventory[reverse_id]) {
      // new segment
      inventory[reverse_id] = feature;
    }
    else {
      // a segment with the same origin/dest exists.  choose shortest.
      const old_cost = inventory[reverse_id].properties._cost;
      const new_cost = feature.properties._cost;
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
  });

  // filter out marked items
  return features.filter(feature => {
    return !feature.properties.__markDelete;
  });

};



// Start CH specific

Graph.prototype.contractGraph = function() {

  // prevent more edges from being added
  this._locked = true;

  // new contracted edges will be added after this index
  this._maxEdgeID = this._edgeIndex;

  // initialize dijkstra shortcut/path finder
  const finder = this._createChShortcutter();

  const getVertexScore = (v) => {
    const shortcut_count = this._contract(v, true, finder); /**/
    const edge_count = (this.adjacency_list[v] || []).length;
    const edge_difference = shortcut_count - edge_count;
    const contracted_neighbors = getContractedNeighborCount(v);
    return edge_difference + contracted_neighbors;
  };

  const getContractedNeighborCount = (v) => {
    return (this.adjacency_list[v] || []).reduce((acc, node) => {
      const is_contracted = this.contracted_nodes[node.end] != null ? 1 : 0;
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
  Object.keys(this._nodeToIndex).forEach(key => {
    const index = this._nodeToIndex[key];
    const score = getVertexScore(index);
    const node = new OrderNode(score, index);
    nh.push(node);
  });

  let contraction_level = 1;

  const len = nh.length;

  // main contraction loop
  while (nh.length > 0) {

    const updated_len = nh.length;

    if (updated_len % 50 === 0) {
      if (this.debugMode) {
        console.log(updated_len / len);
      }
      // prune adj list of no longer valid paths occasionally
      // theres probably a better formula for determining how often this should run
      // (bigger networks = less often)
      this._cleanAdjList(this.adjacency_list);
      this._cleanAdjList(this.reverse_adjacency_list);
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

  this._cleanAdjList(this.adjacency_list);
  this._cleanAdjList(this.reverse_adjacency_list);
  this._arrangeContractedPaths(this.adjacency_list);
  this._arrangeContractedPaths(this.reverse_adjacency_list);

  return;

};

// do as much edge arrangement as possible ahead of times so that the cost is
// not incurred at runtime
Graph.prototype._arrangeContractedPaths = function(adj_list) {

  adj_list.forEach((node, index) => {

    node.forEach(edge => {

      const start_node = index;

      let simpleIds = [];
      let ids = [];

      ids = [edge.attrs]; // edge.attrs is an edge ID

      while (ids.length) {
        const id = ids.pop();
        if (id <= this._maxEdgeID) {
          // this is an original network edge
          simpleIds.push(id);
        }
        else {
          // these are shorcut edges (added during contraction process)
          // where _id is an array of two items: edges of [u to v, v to w]
          ids.push(...this._properties[id]._id);
        }
      }


      //  now with simpleIds, get start and end index and make connection object
      const links = {};
      simpleIds.forEach(id => {
        const properties = this._properties[id];
        const start_index = properties._start_index;
        const end_index = properties._end_index;

        if (!links[start_index]) {
          links[start_index] = [id];
        }
        else {
          links[start_index].push(id);
        }

        if (!links[end_index]) {
          links[end_index] = [id];
        }
        else {
          links[end_index].push(id);
        }
      });

      const ordered = [];

      let last_node = String(start_node);

      let current_edge_id = links[last_node][0];
      // this value represents the attribute id of the first segment

      while (current_edge_id != null) {

        ordered.push(current_edge_id);
        // put this in the ordered array of attribute segments

        // this represents the nodes of the first segment
        const props = this._properties[current_edge_id];
        const c1 = String(props._start_index);
        const c2 = String(props._end_index);

        // c1 and c2 represent the first and last nodes of the line string
        // these nodes can be out of order; in fact 50% chance
        // so check to see if the first node = start
        // if it is, use c2, if not, use c1
        const next_node = c1 === last_node ? c2 : c1;

        last_node = next_node;

        const arr = links[next_node];
        // receive an array of 2 attribute segments.  
        // we've already seen one of them, so grab the other

        if (arr.length === 1) {
          // if the length of this is 1, it means we're at the end
          break;
        }

        if (arr.length > 2) {
          console.error('too many edges in array. unexpected. unrecoverable.');
          process.exit();
        }

        current_edge_id = arr[0] === current_edge_id ? arr[1] : arr[0];
      }

      this._properties[edge.attrs]._ordered = ordered;

    });
  });

};

Graph.prototype._cleanAdjList = function(adj_list) {

  // remove links to lower ranked nodes
  adj_list.forEach((node, node_id) => {
    const from_rank = this.contracted_nodes[node_id];
    if (from_rank == null) {
      return;
    }
    adj_list[node_id] = adj_list[node_id].filter(
      edge => {
        const to_rank = this.contracted_nodes[edge.end];
        if (to_rank == null) {
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

  // all edges from anywhere to v
  const from_connections = (this.reverse_adjacency_list[v] || []).filter(c => {
    return !this.contracted_nodes[c.end];
  });


  // all edges from v to somewhere else
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


    // HRM if okay, turn this back on
    if (!to_connections.length) {
      // no sense in running dijkstra
      return;
    }

    // run a dijkstra from u to anything less than the existing dijkstra distance
    const path = finder.runDijkstra(
      u.end,
      null,
      v,
      max_total
    );

    to_connections.forEach(w => {
      if (u.end === w.end) {
        return;
      }

      // dist v to w
      const dist2 = w.cost;
      const total = dist1 + dist2;

      const dijkstra = path.distances[w.end] || Infinity;

      if (total < dijkstra) {

        shortcut_count++;

        if (!get_count_only) {

          const props = {
            _cost: total,
            _id: [u.attrs, w.attrs],
            _start_index: u.end,
            _end_index: w.end
          };

          this._addContractedEdge(u.end, w.end, props);
        }
      }
    });

  });

  return shortcut_count;
};

Graph.prototype.loadCH = function(ch) {
  const parsed = JSON.parse(ch);
  this.adjacency_list = parsed.adjacency_list;
  this.reverse_adjacency_list = parsed.reverse_adjacency_list;
  this._nodeToIndex = parsed._nodeToIndex;
  this._properties = parsed._properties;
  this._geometry = parsed._geometry;

  // this._rebuildReverseAdjList();
};

Graph.prototype.saveCH = function() {
  return JSON.stringify({
    adjacency_list: this.adjacency_list,
    reverse_adjacency_list: this.reverse_adjacency_list,
    _nodeToIndex: this._nodeToIndex,
    _properties: this._properties,
    _geometry: this._geometry
  });
};


// HRM, probably delete this thing
Graph.prototype._rebuildReverseAdjList = function() {

  // destroy and build anew
  // TODO future, rename old one.  its not the same thing.
  this.reverse_adjacency_list = [];

  this.adjacency_list.forEach((node, index) => {

    node.forEach(edge => {

      const start_node = edge.end;
      const end_node = index;

      const obj = {
        end: end_node,
        cost: edge.cost,
        attrs: edge.attrs
      };

      if (!this.reverse_adjacency_list[start_node]) {
        this.reverse_adjacency_list[start_node] = [obj];
      }
      else {
        this.reverse_adjacency_list[start_node].push(obj);
      }

    });

  });

};


// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}



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

    return { distances, nodeState };

  }

};



Graph.prototype.createPathfinder = function(options) {

  const adjacency_list = this.adjacency_list;
  const reverse_adjacency_list = this.reverse_adjacency_list;
  const properties = this._properties;
  const geometry = this._geometry;
  const pool = this._createNodePool();
  const nodeToIndex = this._nodeToIndex;

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

    const start_index = nodeToIndex[String(start)];
    const end_index = nodeToIndex[String(end)];

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
      forward_nodeState,
      forward_distances,
      backward_nodeState,
      backward_distances
    );
    const searchBackward = doDijkstra(
      reverse_adjacency_list,
      current_end,
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
    let ids = {};

    if (options.ids === true || options.path === true) {
      if (tentative_shortest_node != null) {
        // tentative_shortest_path as falsy indicates no path found.
        ids = buildIdList(options, properties, geometry, forward_nodeState, backward_nodeState, tentative_shortest_node, start_index);
      }
      else {
        // fill in object to prevent errors in the case of no path found
        if (options.ids && options.path) {
          ids = { ids: [], path: {} };
        }
        else if (!options.ids && options.path) {
          ids = { path: {} };
        }
        else if (options.ids && !options.path) {
          ids = { ids: [] };
        }
        else {
          // should not happen
          ids = {};
        }
      }

    }

    return Object.assign(result, { ...ids });

    function* doDijkstra(
      adj,
      current,
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
        (adj[current.id] || []).forEach(edge => {

          let node = nodeState[edge.end];
          if (node === undefined) {
            node = pool.createNewState({ id: edge.end });
            node.attrs = edge.attrs;
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
          node.attrs = edge.attrs;
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
