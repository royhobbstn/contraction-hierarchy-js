const { buildIdList } = require('./buildOutputs.js');
const NodeHeap = require('./queue.js');

exports.createPathfinder = function(options) {

  const adjacency_list = this.adjacency_list;
  const reverse_adjacency_list = this.reverse_adjacency_list;
  const edgeProperties = this._edgeProperties;
  const edgeGeometry = this._edgeGeometry;
  const pool = this._createNodePool();
  const nodeToIndexLookup = this._nodeToIndexLookup;

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

    const start_index = nodeToIndexLookup[String(start)];
    const end_index = nodeToIndexLookup[String(end)];

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
        ids = buildIdList(options, edgeProperties, edgeGeometry, forward_nodeState, backward_nodeState, tentative_shortest_node, start_index);
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
