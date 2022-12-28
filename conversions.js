var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]

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
 * Gets the lat and long coordinates from the relative coordinates.
 * @param {double} x 
 * @param {double} z 
 * @returns lat and long
 */
function getLatLongFromRelativePosition(x, z) {
    return {lat: x+centreLat, long: z+centreLong};
}

/**
 * It takes a centre coordinate and a size, and returns a bounding box
 * @param centreCoords - The coordinates of the centre of the bounding box.
 * @param [size=50] - The size of the bounding box.
 * @returns An object with four properties: minX, minY, maxX, maxY.
 */
function getBoundingBoxFromPixelCoords(centreCoords, metres) {
    metres /= twfData[0];
    return {minX: centreCoords.x-(size/2),
            minY: centreCoords.y-(size/2),
            maxX: centreCoords.x+(size/2),
            maxY: centreCoords.y+(size/2)
           }
}

function getBoundingBoxFromLatLong(centreCoords, metres=100) {
    km = metres/1000;
    minLat = centreCoords.lat - (0.009*km)
    minLon = centreCoords.lon - (0.009*km)
    maxLat = centreCoords.lat + (0.009*km)
    maxLon = centreCoords.lon + (0.009*km)
    console.log("Bounding bos solution one:\n", {minLat: minLat, minLon: minLon, maxLat: maxLat, maxLon: maxLon});
    
    // const p = turf.point([centreCoords.lon, centreCoords.lat]);
    // buffer = turf.buffer(p, km, {units: 'kilometers'});
    // bbox = turf.bbox(buffer);
    // poly = turf.bboxPolygon(bbox);
    // console.log("Second solution:\n", poly);
}

/**
 * Converts from UTM coords to lat and long coords.
 * @param {double} easting 
 * @param {double} northing 
 * @returns lat and long
 */
function convertUTMToLatAndLong(easting, northing) {
    proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs');
    var source = new proj4.Proj('EPSG:27700');
    var dest = new proj4.Proj('EPSG:4326');     //WGS84
    var testPt = new proj4.toPoint([easting, northing]);
    //var testPt = new proj4.Point(easting, northing);
    return proj4.transform(source, dest, testPt);
}

/**
 * Converts from lat and long to Easting and Northing UTM coords.
 * @param {double} lat 
 * @param {double} long 
 * @returns Easting and Northing UTM coords
 */
function convertLatLongToUTM(lat, long) {
    proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs');
    var source = new proj4.Proj('EPSG:4326');   //WGS84
    var dest = new proj4.Proj('EPSG:27700');
    var testPt = new proj4.toPoint([long, lat]);
    return proj4.transform(source, dest, testPt);
}


// Line 0: A: pixel size in the x-direction in map units/pixel
// Line 1: D: rotation about y-axis
// Line 2: B: rotation about x-axis
// Line 3: E: pixel size in the y-direction in map units, almost always negative[3]
// Line 4: C: x-coordinate of the center of the upper left pixel
// Line 5: F: y-coo

// A, B, C, D, E, F
// 0, 2, 4, 1, 3, 5
// x = (3x'-2y'+2*5-3*4)/(0*3-1*2)
// y = (-1x'+0y'+1*4-0*5)/(0*3-1*2)

/*
    To go from UTM(x'y') to pixel position(x,y) one can use the equation:
    x = (Ex'-By'+BF-EC)/(AE-DB)
    y = (-Dx'+Ay'+DC-AF)/(AE-DB)
*/

/**
 * It takes in the easting and northing of a point, and returns the pixel coordinates of that point
 * @param {double} easting - The easting coordinate of the point you want to convert.
 * @param {double} northing - The northing coordinate of the point you want to convert.
 * @returns A promise that resolves to an object containing the x and y pixel coordinates.
 */
function convertUTMToPixelCoords(easting, northing) {
    let x = (twfData[3]*easting-twfData[2]*northing+twfData[2]*twfData[5]-twfData[3]*twfData[4])/(twfData[0]*twfData[3]-twfData[1]*twfData[2]);
    let y = (-twfData[1]*easting+twfData[0]*northing+twfData[1]*twfData[4]-twfData[0]*twfData[5])/(twfData[0]*twfData[3]-twfData[1]*twfData[2]);
    let xy = convertToNewPixelCoords(x, y);
    //x = Math.round(xy.x);
    //y = Math.round(xy.y);
    return {x: xy.x, y: xy.y};
}


/**
 * Converts pixel coord from old image to the new image.
 * @param {double} x x coordinate of the pixel
 * @param {double} y y coordinate of the pixel
 * @returns The updated position
 */
function convertToNewPixelCoords(x, y) {
    //x -= (xPixel);
    //y -= (yPixel);
    //console.log({x: x, y: y});
    return {x: x, y: y};
}