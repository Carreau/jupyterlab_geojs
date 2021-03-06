import logging
import unittest

logging.basicConfig(level=logging.DEBUG)

from . import utils
from jupyterlab_geojs import GeoJSMap

ny_polygons = { "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-78.878369, 42.886447],
      [-76.147424, 43.048122],
      [-75.910756, 43.974784],
      [-73.756232, 42.652579],
      [-75.917974, 42.098687],
      [-78.429927, 42.083639],
      [-78.878369, 42.886447]
    ]]
  },
  "properties": {
    "author": "Kitware",
    "cities": ["Buffalo", "Syracuse", "Watertown", "Albany", "Binghamton", "Olean"]
  }
}

class TestGeoJSONFeatures(unittest.TestCase):

    def test_geojson_features(self):
        '''Test creating geojson features'''
        geo_map = GeoJSMap()
        geo_map.center = {'x': -76.5, 'y': 43.0};
        geo_map.zoom = 7;
        geo_map.createLayer('osm', renderer='canvas');
        feature_layer = geo_map.createLayer('feature', features=['point', 'line', 'polygon'])
        feature_layer.createFeature('geojson', data=ny_polygons)

        data = geo_map._build_data()
        #print(data)

        # Validate data model against schema
        utils.validate_model(data)

        # Optionally write result to model file
        utils.write_model(data, 'geojson_model.json')

if __name__ == '__main__':
    unittest.main()
