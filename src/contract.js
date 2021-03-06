import { NodeHeap } from './queue.js';


export const contractGraph = function() {

  if (this._locked) {
    throw new Error('Network has already been contracted');
  }

  // prevent more edges from being added
  this._locked = true;

  // new contracted edges will be added after this index
  this._maxUncontractedEdgeIndex = this._currentEdgeIndex;

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
  Object.keys(this._nodeToIndexLookup).forEach(key => {
    const index = this._nodeToIndexLookup[key];
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

  if (this.debugMode) {
    console.log('Contraction complete');
  }

  return;

};

// do as much edge arrangement as possible ahead of times so that the cost is
// not incurred at runtime
export const _arrangeContractedPaths = function(adj_list) {

  adj_list.forEach((node, index) => {

    node.forEach(edge => {

      const start_node = index;

      let simpleIds = [];
      let ids = [];

      ids = [edge.attrs]; // edge.attrs is an edge ID

      while (ids.length) {
        const id = ids.pop();
        if (id <= this._maxUncontractedEdgeIndex) {
          // this is an original network edge
          simpleIds.push(id);
        }
        else {
          // these are shorcut edges (added during contraction process)
          // where _id is an array of two items: edges of [u to v, v to w]
          ids.push(...this._edgeProperties[id]._id);
        }
      }


      //  now with simpleIds, get start and end index and make connection object
      const links = {};
      simpleIds.forEach(id => {
        const properties = this._edgeProperties[id];
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
        const props = this._edgeProperties[current_edge_id];
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

      this._edgeProperties[edge.attrs]._ordered = ordered;

    });
  });

};

export const _cleanAdjList = function(adj_list) {

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
export const _contract = function(v, get_count_only, finder) {

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




// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}

export const _createChShortcutter = function() {

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

      (adjacency_list[current.id] || [])
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
