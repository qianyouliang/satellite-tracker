import * as THREE from "three";

/* Draw GeoJSON

Iterates through the latitude and longitude values, converts the values to XYZ coordinates,
and draws the geoJSON geometries.

*/

export function drawThreeGeo(json, radius, shape, materalOptions, container) {

  const x_values = [];
  const y_values = [];
  const z_values = [];

  const json_geom = createGeometryArray(json);
  //An array to hold the feature geometries.
  const convertCoordinates = getConversionFunctionName(shape);
  //Whether you want to convert to spherical or planar coordinates.
  let coordinate_array = [];
  //Re-usable array to hold coordinate values. This is necessary so that you can add
  //interpolated coordinates. Otherwise, lines go through the sphere instead of wrapping around.

  for (let geom_num = 0; geom_num < json_geom.length; geom_num++) {
    // console.log(json_geom[geom_num].type);
    if (json_geom[geom_num].type == 'Point') {
      convertCoordinates(json_geom[geom_num].coordinates, radius);
      drawParticle(x_values[0], y_values[0], z_values[0], materalOptions);

    } else if (json_geom[geom_num].type == 'MultiPoint') {
      for (let point_num = 0; point_num < json_geom[geom_num].coordinates.length; point_num++) {
        convertCoordinates(json_geom[geom_num].coordinates[point_num], radius);
        drawParticle(x_values[0], y_values[0], z_values[0], materalOptions);
      }

    } else if (json_geom[geom_num].type == 'LineString') {
      coordinate_array = createCoordinateArray(json_geom[geom_num].coordinates);

      for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
        convertCoordinates(coordinate_array[point_num], radius);
      }
      drawLine(x_values, y_values, z_values, materalOptions);

    } else if (json_geom[geom_num].type == 'Polygon') {
      for (let segment_num = 0; segment_num < json_geom[geom_num].coordinates.length; segment_num++) {
        coordinate_array = createCoordinateArray(json_geom[geom_num].coordinates[segment_num]);

        for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
          convertCoordinates(coordinate_array[point_num], radius);
        }
        drawLine(x_values, y_values, z_values, materalOptions);
      }

    } else if (json_geom[geom_num].type == 'MultiLineString') {
      for (let segment_num = 0; segment_num < json_geom[geom_num].coordinates.length; segment_num++) {
        coordinate_array = createCoordinateArray(json_geom[geom_num].coordinates[segment_num]);

        for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
          convertCoordinates(coordinate_array[point_num], radius);
        }
        drawLine(x_values, y_values, z_values, materalOptions);
      }

    } else if (json_geom[geom_num].type == 'MultiPolygon') {
      for (let polygon_num = 0; polygon_num < json_geom[geom_num].coordinates.length; polygon_num++) {
        for (let segment_num = 0; segment_num < json_geom[geom_num].coordinates[polygon_num].length; segment_num++) {
          coordinate_array = createCoordinateArray(json_geom[geom_num].coordinates[polygon_num][segment_num]);

          for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
            convertCoordinates(coordinate_array[point_num], radius);
          }
          drawLine(x_values, y_values, z_values, materalOptions);
        }
      }
    } else {
      throw new Error('The geoJSON is not valid.');
    }
  }

  function createGeometryArray(json) {
    let geometry_array = [];

    if (json.type == 'Feature') {
      geometry_array.push(json.geometry);
    } else if (json.type == 'FeatureCollection') {
      for (let feature_num = 0; feature_num < json.features.length; feature_num++) {
        geometry_array.push(json.features[feature_num].geometry);
      }
    } else if (json.type == 'GeometryCollection') {
      for (let geom_num = 0; geom_num < json.geometries.length; geom_num++) {
        geometry_array.push(json.geometries[geom_num]);
      }
    } else {
      throw new Error('The geoJSON is not valid.');
    }
    //alert(geometry_array.length);
    return geometry_array;
  }

  function getConversionFunctionName(shape) {
    let conversionFunctionName;

    if (shape == 'sphere') {
      conversionFunctionName = convertToSphereCoords;
    } else if (shape == 'plane') {
      conversionFunctionName = convertToPlaneCoords;
    } else {
      throw new Error('The shape that you specified is not valid.');
    }
    return conversionFunctionName;
  }

  function createCoordinateArray(feature) {
    //Loop through the coordinates and figure out if the points need interpolation.
    const temp_array = [];
    let interpolation_array = [];

    for (let point_num = 0; point_num < feature.length; point_num++) {
      const point1 = feature[point_num];
      const point2 = feature[point_num - 1];

      if (point_num > 0) {
        if (needsInterpolation(point2, point1)) {
          interpolation_array = [point2, point1];
          interpolation_array = interpolatePoints(interpolation_array);

          for (let inter_point_num = 0; inter_point_num < interpolation_array.length; inter_point_num++) {
            temp_array.push(interpolation_array[inter_point_num]);
          }
        } else {
          temp_array.push(point1);
        }
      } else {
        temp_array.push(point1);
      }
    }
    return temp_array;
  }

  function needsInterpolation(point2, point1) {
    //If the distance between two latitude and longitude values is
    //greater than five degrees, return true.
    const lon1 = point1[0];
    const lat1 = point1[1];
    const lon2 = point2[0];
    const lat2 = point2[1];
    const lon_distance = Math.abs(lon1 - lon2);
    const lat_distance = Math.abs(lat1 - lat2);

    if (lon_distance > 5 || lat_distance > 5) {
      return true;
    } else {
      return false;
    }
  }

  function interpolatePoints(interpolation_array) {
    //This function is recursive. It will continue to add midpoints to the
    //interpolation array until needsInterpolation() returns false.
    let temp_array = [];
    let point1, point2;

    for (let point_num = 0; point_num < interpolation_array.length - 1; point_num++) {
      point1 = interpolation_array[point_num];
      point2 = interpolation_array[point_num + 1];

      if (needsInterpolation(point2, point1)) {
        temp_array.push(point1);
        temp_array.push(getMidpoint(point1, point2));
      } else {
        temp_array.push(point1);
      }
    }

    temp_array.push(interpolation_array[interpolation_array.length - 1]);

    if (temp_array.length > interpolation_array.length) {
      temp_array = interpolatePoints(temp_array);
    } else {
      return temp_array;
    }
    return temp_array;
  }

  function getMidpoint(point1, point2) {
    const midpoint_lon = (point1[0] + point2[0]) / 2;
    const midpoint_lat = (point1[1] + point2[1]) / 2;
    const midpoint = [midpoint_lon, midpoint_lat];

    return midpoint;
  }

  function convertToSphereCoords(coordinates_array, sphere_radius) {
    const lon = coordinates_array[0];
    const lat = coordinates_array[1];

    x_values.push(Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180) * sphere_radius);
    y_values.push(Math.cos(lat * Math.PI / 180) * Math.sin(lon * Math.PI / 180) * sphere_radius);
    z_values.push(Math.sin(lat * Math.PI / 180) * sphere_radius);
  }

  function convertToPlaneCoords(coordinates_array, radius) {
    const lon = coordinates_array[0];
    const lat = coordinates_array[1];

    z_values.push((lat / 180) * radius);
    y_values.push((lon / 180) * radius);
  }

  function drawParticle(x, y, z, options) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([x, y, z], 3)
    );

    const particle_material = new THREE.PointsMaterial(options);

    const particle = new THREE.Points(particle_geom, particle_material);
    container.add(particle);

    clearArrays();
  }

  function drawLine(x_values, y_values, z_values, options) {
    const line_geom = new THREE.BufferGeometry();
    createVertexForEachPoint(line_geom, x_values, y_values, z_values);

    const line_material = new THREE.LineBasicMaterial(options);
    const line = new THREE.Line(line_geom, line_material);
    container.add(line);

    clearArrays();
  }

  function createVertexForEachPoint(object_geometry, values_axis1, values_axis2, values_axis3) {
    const verts = [];
    for (let i = 0; i < values_axis1.length; i++) {
      verts.push(values_axis1[i], values_axis2[i], values_axis3[i]);
    }
    object_geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verts, 3)
    );
  }

  function clearArrays() {
    x_values.length = 0;
    y_values.length = 0;
    z_values.length = 0;
  }
}
