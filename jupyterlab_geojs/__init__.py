version_info = (0, 3, 0, 'dev')
__version__ = ".".join(map(str, version_info))

from .geojsmap import GeoJSMap
Scene = GeoJSMap  # alias
