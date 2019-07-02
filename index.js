const kdbush = require('kdbush');
const geokdbush = require('geokdbush');
const NodeHeap = require('./queue.js');
const cloneGeoJson = require('@turf/clone').default;

// objects
exports.Graph = Graph;
exports.CoordinateLookup = CoordinateLookup;

function Graph(geojson, opt) {
  const options = opt || {};
  this.debugMode = options.debugMode || false;
  this.adjacency_list = [];
  this._createNodePool = createNodePool;

  this._coordsIndex = -1;
  this._strCoordsToIndex = {};
  this._indexToStrCoords = []; // todo may not ever be needed

  this._propertiesIndex = -1;
  this._properties = [];
  this._geometry = [];
  this._maxID = 0;

  if (geojson) {
    this.loadFromGeoJson(geojson);
  }
}

function CoordinateLookup(graph) {

  const points_set = new Set();

  Object.keys(graph.adjacency_list).forEach(key => {
    points_set.add(key);
  });

  const coordinate_list = [];

  points_set.forEach(pt_str => {
    coordinate_list.push(pt_str.split(',').map(d => Number(d)));
  });

  this.index = kdbush(coordinate_list, (p) => p[0], (p) => p[1]);
}

CoordinateLookup.prototype.getClosestNetworkPt = function(lng, lat) {
  return geokdbush.around(this.index, lng, lat, 1)[0];
};

Graph.prototype._addEdge = function(startNode, endNode, properties, geometry) {

  // input can now be String or Number coordinates (or anything!) makes no difference
  const start_node = String(startNode);
  const end_node = String(endNode);

  if (start_node === end_node) {
    if (this.debugMode) {
      console.log("Start and End Nodes are the same.  Ignoring.");
    }
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

  let start_index = this._strCoordsToIndex[start_node];
  let end_index = this._strCoordsToIndex[end_node];

  this._properties[properties._id] = properties;
  this._geometry[properties._id] = geometry;

  // so that we know what the max value for _id is
  // contraction _ids will begin after this number
  if (properties._id > this._maxID) {
    this._maxID = properties._id;
  }

  // create object to push into adjacency list
  const obj = {
    end: end_index,
    cost: properties._cost,
    attrs: properties._id
  };

  if (this.adjacency_list[start_index]) {
    this.adjacency_list[start_index].push(obj);
  }
  else {
    this.adjacency_list[start_index] = [obj];
  }

  const reverse_obj = {
    end: start_index,
    cost: properties._cost,
    attrs: properties._id
  };

  if (this.adjacency_list[end_index]) {
    this.adjacency_list[end_index].push(reverse_obj);
  }
  else {
    this.adjacency_list[end_index] = [reverse_obj];
  }

};


Graph.prototype._addContractedEdge = function(startNode, endNode, properties, geometry) {

  let start_index = startNode;
  let end_index = endNode;

  this._propertiesIndex++;
  this._properties[this._propertiesIndex] = properties;
  this._geometry[this._propertiesIndex] = geometry;

  // create object to push into adjacency list
  const obj = {
    end: end_index,
    cost: properties._cost,
    attrs: this._propertiesIndex
  };

  if (this.adjacency_list[start_index]) {
    this.adjacency_list[start_index].push(obj);
  }
  else {
    this.adjacency_list[start_index] = [obj];
  }

  const reverse_obj = {
    end: start_index,
    cost: properties._cost,
    attrs: this._propertiesIndex
  };

  if (this.adjacency_list[end_index]) {
    this.adjacency_list[end_index].push(reverse_obj);
  }
  else {
    this.adjacency_list[end_index] = [reverse_obj];
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
  const geo = cloneGeoJson(filedata);

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


    this._addEdge(start_vertex, end_vertex, properties, coordinates);
  });

  this._propertiesIndex = this._maxID;

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

Graph.prototype.createFinder = function(opts) {

  const options = opts || {};
  const parseOutputFns = options.parseOutputFns || [];
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
        return a.dist - b.dist;
      }
    });

    let current = pool.createNewState({ id: start_index, dist: 0 });
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
            // longer path	
            return;
          }

          node.dist = proposed_distance;
          node.prev = edge;

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
      this._cleanAdjList();
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

};

// this function is multi-use:  actually contract a node  OR
// with `get_count_only = true` find number of shortcuts added
// if node were to be contracted
Graph.prototype._contract = function(v, get_count_only, finder) {

  const from_connections = (this.adjacency_list[v] || []).filter(c => {
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

          // TODO here, dig up the actual path.  Tap into the node [w.end] and trace a path via the .prev property
          // for now, tack on an extra property to the object below

          console.log("****")
          console.log({ total, dijkstra })
          console.log(path.nodeState[w.end]);
          // TODO Dijkstra = inifinity === nothing here.  WHY?

          const attrs = {
            _cost: total,
            _id: [u.attrs, w.attrs]
          };

          this._addContractedEdge(u.end, w.end, attrs, null);
        }
      }
    });

  });

  return shortcut_count;
};

Graph.prototype.loadCH = function(ch) {
  const parsed = JSON.parse(ch);
  this.adjacency_list = parsed.adjacency_list;
  this._strCoordsToIndex = parsed._strCoordsToIndex;
  this._properties = parsed._properties;
  this._geometry = parsed._geometry;
};

Graph.prototype.saveCH = function() {
  return JSON.stringify({
    adjacency_list: this.adjacency_list,
    _strCoordsToIndex: this._strCoordsToIndex,
    _properties: this._properties,
    _geometry: this._geometry
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

    // TODO need to return actual shortest path with IDs
    let response = { distances, nodeState };

    return response;
  }

};



Graph.prototype.createPathfinder = function(options) {

  const adjacency_list = this.adjacency_list;
  const properties = this._properties;
  const geometry = this._geometry;
  const pool = this._createNodePool();
  const strCoordsToIndex = this._strCoordsToIndex;

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
      forward_nodeState,
      forward_distances,
      backward_nodeState,
      backward_distances
    );
    const searchBackward = doDijkstra(
      adjacency_list,
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
        ids = buildIdList(options, adjacency_list, properties, geometry, forward_nodeState, backward_nodeState, tentative_shortest_node, String(start));
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
        adj[current.id].forEach(edge => {

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


function buildIdList(options, adjacency_list, properties, geometry, forward_nodeState, backward_nodeState, tentative_shortest_node, start) {

  const path = [];

  let current_forward_node = forward_nodeState[tentative_shortest_node];
  let current_backward_node = backward_nodeState[tentative_shortest_node];

  // first check necessary because may not be any nodes in forward or backward path
  // (occasionally entire path may be ONLY in the backward or forward directions)
  if (current_forward_node) {
    while (current_forward_node.attrs) {
      path.push(current_forward_node.attrs);
      current_forward_node = forward_nodeState[current_forward_node.prev];
    }
  }

  if (current_backward_node) {
    while (current_backward_node.attrs) {
      path.push(current_backward_node.attrs);
      current_backward_node = backward_nodeState[current_backward_node.prev];
    }
  }


  console.log({ path })

  const ids = [];

  console.time('pop')
  while (path.length) {

    const id = path.pop();

    const p = properties[id];
    const g = geometry[id]; // dont look up geometry too!

    // if geometry = null, must be a contracted node
    if (!g) {
      const arr = p._id;
      arr.forEach(item => {
        path.push(Number(item));
      });
    }
    else {
      // else put into a links object
      ids.push({ id, start: g[0], end: g[g.length - 1] });
    }
  }
  console.timeEnd('pop')

  console.time('links')

  const links = {};

  ids.forEach(id => {

    if (!links[id.start]) {
      links[id.start] = [id.id];
    }
    else {
      links[id.start].push(id.id);
    }

    if (!links[id.end]) {
      links[id.end] = [id.id];
    }
    else {
      links[id.end].push(id.id);
    }
  });

  console.timeEnd('links')


  // `links`:
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

  console.time('ordered')

  const ordered = [];

  let last = start;

  let val = links[start][0];
  // this value represents the attribute id of the first segment

  while (val) {

    ordered.push(val);
    // put this in the ordered array of attribute segments

    const coords = geometry[val];
    // this represents the coordinate string of the first segment

    const c1 = String(coords[0]);
    const c2 = String(coords[coords.length - 1]);
    // c1 and c2 represent the first and last coordinates of the line string
    // these coordinates can be out of order; 50% chance
    // so check to see if the first coordinate = start
    // if it is, use c2, if not, use c1
    const next = c1 === last ? c2 : c1;
    last = next;

    const arr = links[next];
    // receive an array of 2 attribute segments.  
    // we've already seen one of them, so grab the other

    if (arr.length === 1) {
      ordered.push(arr[0]);
      // if the length of this is 1, it means we're at the end
      break;
    }

    val = arr[0] === val ? arr[1] : arr[0];
  }

  console.timeEnd('ordered')


  console.log({ ordered })

  if (options.path) {
    return { ids: mapToIds(ordered, properties), path: mapToGeoJson(ordered, properties, geometry) };
  }
  else {
    return { ids: mapToIds(ordered, properties) };
  }

}

function mapToIds(ordered, properties) {
  return ordered.map(attr_id => {
    return properties[attr_id]._id;
  });
}

function mapToGeoJson(ordered, properties, geometry) {
  const features = ordered.map(attr_id => {
    const props = properties[attr_id];
    const geo = geometry[attr_id];
    return {
      "type": "Feature",
      "properties": props,
      "geometry": {
        "type": "LineString",
        "coordinates": geo
      }
    };
  });

  return detangle({ "type": "FeatureCollection", "features": features });
}

function detangle(geo) {

  // ------ de-tangle routine
  // aligns start and end coordinate of each geojson linestring segment

  // copy source to avoid mutation
  const features = cloneGeoJson(geo).features;

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
