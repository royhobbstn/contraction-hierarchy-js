//
const fs = require('fs').promises;

// API Design
//
// import {runContraction, Chase} from 'chase-js'
// const {runContraction, runValidation, Chase} = require('chase-js');
//
//
// reference to my geojson cleanup library in Docs
//
// runContraction options: { (debug) }
// runValidation (looping segments or otherwise bad geojson)
//
// return Chase object
//
// new Chase()
//
//   .saveHierarchy - this is just geojson w extra edges, + arc-flags + options metadata
//   .loadHierarchy -
// .query({geojson=true, segmentIds=true, distance=true})

exports.runContraction = runContraction;
exports.runValidation = runValidation;
exports.Chase = Chase;

function Chase(obj) {
  if (!obj) {
    this.contractionHierarchy = null;
    this.nodeRank = null;
    this.edgeList = null;
  } else {
    this.contractionHierarchy = obj.contractionHierarchy;
    this.nodeRank = obj.nodeRank;
    this.edgeList = obj.edgeList;
  }
}

Chase.prototype.loadHierarchy = async function(obj) {
  try {
    const raw_data = await fs.readFile(`./${obj.path}`, 'utf8');
    const parsed = JSON.parse(raw_data);
    this.contractionHierarchy = parsed.contractionHierarchy;
    this.nodeRank = parsed.nodeRank;
    this.edgeList = parsed.edgeList;
  } catch (e) {
    console.log('Loading failed');
    throw e;
  }
  console.log('Hierarchy has been loaded');
};

Chase.prototype.saveHierarchy = async function(path) {
  const hierarchy_obj = {
    contractionHierarchy: this.contractionHierarchy,
    nodeRank: this.nodeRank,
    edgeList: this.edgeList
  };
  try {
    await fs.writeFile(`./${path}.ch`, JSON.stringify(hierarchy_obj), 'utf8');
  } catch (e) {
    console.log('Saving failed');
    throw e;
  }
  console.log('Hierarchy has been saved');
};

Chase.prototype.query = function(path) {
  return 0;
};
