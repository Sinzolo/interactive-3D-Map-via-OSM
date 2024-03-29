'use strict';

proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs');
const EPSG27700 = new proj4.Proj('EPSG:27700');
const EPSG4326 = new proj4.Proj('EPSG:4326');     //WGS84
var pixelCoordsOffset;

/**
 * Converts from UTM coords to lat and long coords.
 * @param {double} easting 
 * @param {double} northing 
 * @returns lat and long
 */
function convertUTMToLatAndLong(easting, northing) {
    return proj4.transform(EPSG27700, EPSG4326, { x: easting, y: northing });
}

/**
 * Converts from lat and long to Easting and Northing UTM coords.
 * @param {double} lat 
 * @param {double} long 
 * @returns Easting and Northing UTM coords
 */
function convertLatLongToUTM(lat, long) {
    return proj4.transform(EPSG4326, EPSG27700, {x: long, y: lat});
}

/*
    Line 0: A: pixel size in the x-direction in map units/pixel
    Line 1: D: rotation about y-axis
    Line 2: B: rotation about x-axis
    Line 3: E: pixel size in the y-direction in map units, almost always negative[3]
    Line 4: C: x-coordinate of the center of the upper left pixel
    Line 5: F: y-coo
    x = (3x'-2y'+2*5-3*4)/(0*3-1*2)
    y = (-1x'+0y'+1*4-0*5)/(0*3-1*2)
    To go from UTM(x'y') to pixel position(x,y) one can use the equation:
    x = (Ex'-By'+BF-EC)/(AE-DB)
    y = (-Dx'+Ay'+DC-AF)/(AE-DB)
*/
/**
 * It takes in the easting and northing of a point, and returns the pixel coordinates of that point.
 * @param {double} easting - The easting coordinate of the point you want to convert.
 * @param {double} northing - The northing coordinate of the point you want to convert.
 * @returns An object containing the x and y pixel coordinates.
 */
function convertUTMToPixelCoords(easting, northing) {
    const [a, b, c, d, e, f] = twfData;
    const x = (d * easting - c * northing + c * f - d * e) / (a * d - b * c);
    const y = (-b * easting + a * northing + b * e - a * f) / (a * d - b * c);
    if (!pixelCoordsOffset) pixelCoordsOffset = { x: x, y: y };
    return { x: x - pixelCoordsOffset.x, y: y - pixelCoordsOffset.y };
}

/**
 * Given a pixel X and Y coordinate, return the UTM easting and northing.
 * @param pixelX - The x coordinate of the pixel you want to convert
 * @param pixelY - The y coordinate of the pixel you want to convert
 * @returns An object with two properties, easting and northing
 */
function convertPixelToUTMCoords(pixelX, pixelY) {
    pixelX += pixelCoordsOffset.x;
    pixelY += pixelCoordsOffset.y;
    let utmEasting = (twfData[0] * (pixelX)) + (twfData[2] * (pixelY)) + twfData[4];
    let utmNorthing = (twfData[1] * (pixelX)) + (twfData[3] * (pixelY)) + twfData[5];
    return { easting: utmEasting, northing: utmNorthing };
}

/**
 * Convert a latitude/longitude coordinate to a pixel coordinate of the '.tiff' file.
 * 
 * @param coordinate - a coordinate object with a lat and long property
 * @returns An object with the x and y coordinates of the pixel.
 */
function convertLatLongToPixelCoords(coordinate) {
    let utm = convertLatLongToUTM(coordinate.lat, coordinate.long);
    let pixelCoords = convertUTMToPixelCoords(utm.x, utm.y);
    return { x: pixelCoords.x, y: pixelCoords.y, roundedX: Math.round(pixelCoords.x), roundedY: Math.round(pixelCoords.y) };
}

/**
 * Convert a pixel coordinate to a latitude/longitude coordinate.
 * 
 * @param coordinate - a coordinate object with a x and y properties
 * @returns An object with the x and y coordinates where x is the latitude and y is the longitude
 */
function convertPixelCoordsToLatLong(pixelCoord) {
    let utm = convertPixelToUTMCoords(pixelCoord.x, pixelCoord.y);
    let latLong = convertUTMToLatAndLong(utm.easting, utm.northing);
    return { lat: parseFloat(latLong.y.toFixed(4)), long: parseFloat(latLong.x.toFixed(4)) };
}

/**
 * It takes a bounding box object and returns it as a string in the format
 * "minLat,minLng,maxLat,maxLng".
 * @param bbox - The bounding box of the area.
 * @returns A string of the bounding box coordinates.
 */
function convertBBoxToString(bbox) {
    return bbox.minLat + "," + bbox.minLng + "," + bbox.maxLat + "," + bbox.maxLng;
}

/**
 * It takes a one dimensional array, and converts it into a two dimensional array.
 * The passed array must have the height and width of the 2D array already attached.
 * @param oneDArray - The 1D array that you want to convert to a 2D array
 * @returns A 2D array
 */
function convert1DArrayTo2DArray(oneDArray) {
    let twoDArray = [];
    for (let i = 0; i < oneDArray.width; i++) {
        twoDArray[i] = [];
        for (let j = 0; j < oneDArray.height; j++) {
            twoDArray[i][j] = oneDArray[0][i + j * oneDArray.width];
        }
    }
    oneDArray = undefined;
    return twoDArray;
}

/**
 * Takes an XML response from the OSM API and converts it to GeoJSON
 * @param response - The response from the OSM API.
 * @returns A GeoJSON object.
 */
function convertOSMResponseToGeoJSON(response) {
    return osmtogeojson(new DOMParser().parseFromString(response, "application/xml"));
}