const { CoordinateLookup } = require('./js/coordinateLookup.js');
const { createPathfinder } = require('./js/pathfinding.js');
const { loadFromGeoJson, _cleanseGeoJsonNetwork } = require('./js/geojson.js');
const { addEdge, _addEdge, _addContractedEdge } = require('./js/addEdge.js');
const { loadCH, saveCH } = require('./js/serialize.js');
const { createNodePool } = require('./js/nodePool.js');
const { contractGraph, _arrangeContractedPaths, _cleanAdjList, _contract, _createChShortcutter } = require('./js/contract.js');

exports.Graph = Graph;
exports.CoordinateLookup = CoordinateLookup;


function Graph(geojson, opt) {
  const options = opt || {};
  this.debugMode = options.debugMode || false;

  this.adjacency_list = [];
  this.reverse_adjacency_list = [];

  this._createNodePool = createNodePool;

  this._currentNodeIndex = -1;
  this._nodeToIndexLookup = {};
  this._indexToNodeLookup = {};

  this._currentEdgeIndex = -1;
  this._edgeProperties = [];
  this._edgeGeometry = [];
  this._maxUncontractedEdgeIndex = 0;

  this._locked = false; // locked if contraction has already been run
  this._geoJsonFlag = false; // if data was loaded as geoJson
  this._manualAdd = false; // if the API was used directly to add edges

  if (geojson) {
    this.loadFromGeoJson(geojson);
  }
}

Graph.prototype.createPathfinder = createPathfinder;

Graph.prototype.loadFromGeoJson = loadFromGeoJson;
Graph.prototype._cleanseGeoJsonNetwork = _cleanseGeoJsonNetwork;

Graph.prototype._addContractedEdge = _addContractedEdge;
Graph.prototype.addEdge = addEdge;
Graph.prototype._addEdge = _addEdge;

Graph.prototype.loadCH = loadCH;
Graph.prototype.saveCH = saveCH;

Graph.prototype.contractGraph = contractGraph;
Graph.prototype._arrangeContractedPaths = _arrangeContractedPaths;
Graph.prototype._cleanAdjList = _cleanAdjList;
Graph.prototype._contract = _contract;
Graph.prototype._createChShortcutter = _createChShortcutter;
