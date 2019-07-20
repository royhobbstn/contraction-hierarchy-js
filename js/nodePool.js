exports.createNodePool = createNodePool;


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
