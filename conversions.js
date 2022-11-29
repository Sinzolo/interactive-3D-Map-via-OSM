/**
 * Gets the relative position based off the lat and long.
 * @param {integer} lat 
 * @param {integer} long 
 * @returns x: , y: , z: 
 */
function getRelativePosition(lat, long) {
    return {x: lat-centreLat,
        y: 0,
        z: long-centreLong};
}

/**
 * Converts from UTM coords to lat and long coords.
 * @param {double} easting 
 * @param {double} northing 
 * @returns lat and long
 */
function convertUTMToLatAndLong(easting, northing) {
    proj4.defs('WGS84', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');
    proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs');
    var source = new proj4.Proj('EPSG:27700');
    var dest = new proj4.Proj('WGS84');
    var testPt = new proj4.Point(easting, northing);
    return proj4.transform(source, dest, testPt);
}

 function convertLatLongToUTM(lat, long) {
    proj4.defs('WGS84', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');
    proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs');
    var source = new proj4.Proj('WGS84');
    var dest = new proj4.Proj('EPSG:27700');
    var testPt = new proj4.Point(long, lat);
    return proj4.transform(source, dest, testPt);
}