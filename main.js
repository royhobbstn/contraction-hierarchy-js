import { CoordinateLookup as CL, __geoindex as GI, __kdindex as KD } from './src/coordinateLookup.js';
import { createPathfinder } from './src/pathfinding.js';
import { _loadFromGeoJson, _cleanseGeoJsonNetwork } from './src/geojson.js';
import { addEdge, _addEdge, _addContractedEdge } from './src/addEdge.js';
import { loadCH, saveCH, loadPbfCH, savePbfCH } from './src/serialize.js';
import { createNodePool } from './src/nodePool.js';
import { contractGraph, _arrangeContractedPaths, _cleanAdjList, _contract, _createChShortcutter } from './src/contract.js';

export const CoordinateLookup = CL;

// backdoor to export spatial indexing for custom solutions
export const __geoindex = GI;
export const __kdindex = KD;

export function Graph(geojson, opt) {
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
    this._loadFromGeoJson(geojson);

    if (this.debugMode) {
      console.log('Nodes: ', this._currentNodeIndex);
      console.log('Edges: ', this._currentEdgeIndex);
    }
  }

}

Graph.prototype.createPathfinder = createPathfinder;

Graph.prototype._loadFromGeoJson = _loadFromGeoJson;
Graph.prototype._cleanseGeoJsonNetwork = _cleanseGeoJsonNetwork;

Graph.prototype._addContractedEdge = _addContractedEdge;
Graph.prototype.addEdge = addEdge;
Graph.prototype._addEdge = _addEdge;

Graph.prototype.loadCH = loadCH;
Graph.prototype.saveCH = saveCH;
Graph.prototype.loadPbfCH = loadPbfCH;
Graph.prototype.savePbfCH = savePbfCH;

Graph.prototype.contractGraph = contractGraph;
Graph.prototype._arrangeContractedPaths = _arrangeContractedPaths;
Graph.prototype._cleanAdjList = _cleanAdjList;
Graph.prototype._contract = _contract;
Graph.prototype._createChShortcutter = _createChShortcutter;
