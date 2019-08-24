import kdbush from 'kdbush';
import geokdbush from 'geokdbush';


export function CoordinateLookup(graph) {

  if (!graph._geoJsonFlag) {
    throw new Error('Cannot use Coordinate Lookup on a non-GeoJson network.');
  }

  const points_set = new Set();

  Object.keys(graph._nodeToIndexLookup).forEach(key => {
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

export const __geoindex = geokdbush;
export const __kdindex = kdbush;
