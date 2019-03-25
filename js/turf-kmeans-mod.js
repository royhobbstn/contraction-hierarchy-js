const turf = require('@turf/turf');
const skmeans = require('skmeans');

exports.clustersKmeans = clustersKmeans;

function clustersKmeans(points, options) {
  // Default Params
  var count = points.features.length;
  options.numberOfClusters =
    options.numberOfClusters || Math.round(Math.sqrt(count / 2));

  // numberOfClusters can't be greater than the number of points
  // fallbacks to count
  if (options.numberOfClusters > count) options.numberOfClusters = count;

  // Clone points to prevent any mutations (enabled by default)
  if (options.mutate !== true) points = turf.clone(points);

  // collect points coordinates
  var data = turf.coordAll(points);

  // create skmeans clusters
  var skmeansResult = skmeans(data, options.numberOfClusters, 'kmpp');

  // store centroids {clusterId: [number, number]}
  var centroids = {};
  skmeansResult.centroids.forEach(function(coord, idx) {
    centroids[idx] = coord;
  });

  // add associated cluster number
  turf.featureEach(points, function(point, index) {
    var clusterId = skmeansResult.idxs[index];
    point.properties.cluster = clusterId;
    point.properties.centroid = centroids[clusterId];
  });

  return points;
}
