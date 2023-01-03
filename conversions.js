

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


// /**
//  * It takes a latitude and longitude and a distance in kilometers, and returns the bounding box that is
//  * the specified distance from the given latitude and longitude
//  * @param latitude - The latitude of the center point of the bounding box.
//  * @param longitude - The longitude of the center point of the bounding box.
//  * @param distance - The distance in kilometers from the center point that you want to calculate the
//  * bounding box for.
//  * @returns an object with the north and south latitudes and the east and west longitudes.
//  */
// function getBoundingBox(latitude, longitude, distance) {
//     const radius = 6371; // Earth's radius in kilometers

//     // Calculate the bounding box's north and south latitudes
//     const northLat = latitude + Math.asin(Math.sin(latitude) * Math.cos(distance / radius) +
//       Math.cos(latitude) * Math.sin(distance / radius) * Math.cos(0));
//     const southLat = latitude + Math.asin(Math.sin(latitude) * Math.cos(distance / radius) +
//       Math.cos(latitude) * Math.sin(distance / radius) * Math.cos(180));

//     // Calculate the bounding box's east and west longitudes
//     const eastLng = longitude + Math.atan2(Math.sin(90) * Math.sin(distance / radius) * Math.cos(latitude),
//       Math.cos(distance / radius) - Math.sin(latitude) * Math.sin(latitude));
//     const westLng = longitude + Math.atan2(Math.sin(270) * Math.sin(distance / radius) * Math.cos(latitude),
//       Math.cos(distance / radius) - Math.sin(latitude) * Math.sin(latitude));

//     return {
//         northLat: northLat,
//         southLat: southLat,
//         eastLng: eastLng,
//         westLng: westLng
//     };
// }

/**
 * It returns the bounding box of a circle with a given center and radius.
 * @param latitude - The latitude of the center point of the search.
 * @param longitude - The longitude of the center of the circle.
 * @param distance - The distance in meters from the center point that you want to find the bounding
 * box for.
 * @returns An object with the north latitude, west longitude, south latitude, and east longitude.
 */
// function getBoundingBox(latitude, longitude, distance) {
//     // Earth's radius, sphere
//     const R = 6378137;

//     // Offsets in meters
//     var dn = distance;
//     var de = distance;

//     // Coordinate offsets in radians
//     var dLat = dn / R;
//     var dLon = de / (R * Math.cos(Math.PI * latitude / 180));

//     // OffsetPosition, decimal degrees
//     var latO = latitude - dLat * 180 / Math.PI;
//     var lonO = longitude - dLon * 180 / Math.PI;
//     var lat1 = latitude + dLat * 180 / Math.PI;
//     var lon1 = longitude + dLon * 180 / Math.PI;

//     return {northLat: latO, westLong: lonO, southLat: lat1, eastLong: lon1};
// }






// /**
//  * "Given a latitude and longitude, return the latitude and longitude of a box that is boundingBoxSize
//  * meters in each direction."
//  * 
//  * The function is a little more complicated than that, but that's the gist of it
//  * @param latitude - The latitude of the center of the bounding box.
//  * @param longitude - The longitude of the center of the bounding box.
//  * @param boundingBoxSize - The size of the bounding box in kilometers.
//  * @returns An object with four properties: lat1, lon1, lat2, lon2.
//  */
// function getBoundingBox(latitude, longitude, boundingBoxSize) {
//     const lat1 = latitude - boundingBoxSize / 110.574;
//     const lon1 = longitude - boundingBoxSize / (111.320 * Math.cos(latitude));
//     const lat2 = latitude + boundingBoxSize / 110.574;
//     const lon2 = longitude + boundingBoxSize / (111.320 * Math.cos(latitude));
//     return {northLat: lat1, westLong: lon1, southLat: lat2, eastLong: lon2};
// }




/**
 * It takes a latitude and longitude and returns the coordinates of a bounding box that is a square
 * with sides of length metres
 * @param metres - the length of one side of the square
 * @param lat - latitude of the center of the bounding box
 * @param long - longitude of the center of the bounding box
 * @returns An object with the minLat, minLng, maxLat, and maxLng properties.
 */
function getBoundingBox(lat, long, metres) {
    metres /= 2;
    const earthRadius = 6371e3; // metres
    const latRadians = lat * Math.PI / 180; // convert latitude to radians
    const lngRadians = long * Math.PI / 180; // convert longitude to radians
    const latDelta = metres / earthRadius; // calculate change in latitude
    const lngDelta = metres / (earthRadius * Math.cos(latRadians)); // calculate change in longitude
  
    // calculate coordinates of bounding box
    const minLat = lat - latDelta * 180 / Math.PI;
    const maxLat = lat + latDelta * 180 / Math.PI;
    const minLng = long - lngDelta * 180 / Math.PI;
    const maxLng = long + lngDelta * 180 / Math.PI;
  
    //return { minLat, maxLat, minLng, maxLng };
    return {minLat, minLng, maxLat, maxLng };
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


/**
 * It takes a bounding box object and returns it as a string in the format
 * "minLat,minLng,maxLat,maxLng".
 * @param bbox - The bounding box of the area.
 * @returns A string of the bounding box coordinates.
 */
function convertBBoxToString(bbox) {
    let string = bbox.minLat+","+bbox.minLng+","+bbox.maxLat+","+bbox.maxLng;
    return string;
}



/**
 * It takes a one dimensional array, and converts it into a two dimensional array.
 * The passed array must have the height and width of the 2D array already attached.
 * @param oneDArray - The 1D array that you want to convert to a 2D array
 * @returns A 2D array
 */
function convert1DArrayTo2DArray(oneDArray) {
    let height = oneDArray.height;
    let width = oneDArray.width;
    var length = height;
    var start = 0;
    var end = width;
    var count = 0;
    // Initialise a 2D array
    twoDArray = new Array(height);
    for (var i = 0; i < twoDArray.length; i++) {
        twoDArray[i] = new Array(width);
    }
    while(length > 0) {
        oneDArray[0].slice(start,end).forEach((element, index) => {
            twoDArray[index][count] = element;
        });
        length -= 1;
        start += width;
        end += width;
        count++;
    }
    return twoDArray;
}