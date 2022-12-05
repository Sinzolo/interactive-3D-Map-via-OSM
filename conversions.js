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

/**
 * Converts from lat and long to Easting and Northing UTM coords.
 * @param {double} lat 
 * @param {double} long 
 * @returns Easting and Northing UTM coords
 */
function convertLatLongToUTM(lat, long) {
    proj4.defs('WGS84', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');
    proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs');
    var source = new proj4.Proj('WGS84');
    var dest = new proj4.Proj('EPSG:27700');
    var testPt = new proj4.Point(long, lat);
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
async function convertUTMToPixelCoords(data, easting, northing) {
    // pixelCoords.then((response) => {
    //     return response.text().then((response) => {
    //         response = response.split("\n");
    //         let x = (response[3]*easting-response[2]*northing+response[2]*response[5]-response[3]*response[4])/(response[0]*response[3]-response[1]*response[2]);
    //         let y = (-response[1]*easting+response[0]*northing+response[1]*response[4]-response[0]*response[5])/(response[0]*response[3]-response[1]*response[2]);
    //         let xy = convertToNewPixelCoords(x, y);
    //         x = Math.round(xy.x);
    //         y = Math.round(xy.y);
    //         return {x: x, y: y};
    //     });
    // });
    // return pixelCoords;
    // twfFile.then(function (file) {
    //     twfData = file.text();
    //     console.log("twfData: ", twfData);
    //     return file.text();
    // })
    // .then(function (response) {
    //     response = response.split("\n");
    //     let x = (response[3]*easting-response[2]*northing+response[2]*response[5]-response[3]*response[4])/(response[0]*response[3]-response[1]*response[2]);
    //     let y = (-response[1]*easting+response[0]*northing+response[1]*response[4]-response[0]*response[5])/(response[0]*response[3]-response[1]*response[2]);
    //     let xy = convertToNewPixelCoords(x, y);
    //     x = Math.round(xy.x);
    //     y = Math.round(xy.y);
    //     console.log({x: x, y: y});
    //     return {x: x, y: y};
    // })
    // .catch(failureCallback);

    // return twfFile.then(response => {
    //     response = response.split("\n");
    //     let x = (response[3]*easting-response[2]*northing+response[2]*response[5]-response[3]*response[4])/(response[0]*response[3]-response[1]*response[2]);
    //     let y = (-response[1]*easting+response[0]*northing+response[1]*response[4]-response[0]*response[5])/(response[0]*response[3]-response[1]*response[2]);
    //     let xy = convertToNewPixelCoords(x, y);
    //     x = Math.round(xy.x);
    //     y = Math.round(xy.y);
    //     return {x: x, y: y};
    // })
    // .catch((e) => {console.log(e);});

    let twfData = data.split("\n");
    let x = (twfData[3]*easting-twfData[2]*northing+twfData[2]*twfData[5]-twfData[3]*twfData[4])/(twfData[0]*twfData[3]-twfData[1]*twfData[2]);
    let y = (-twfData[1]*easting+twfData[0]*northing+twfData[1]*twfData[4]-twfData[0]*twfData[5])/(twfData[0]*twfData[3]-twfData[1]*twfData[2]);
    let xy = convertToNewPixelCoords(x, y);
    x = Math.round(xy.x);
    y = Math.round(xy.y);
    return {x: x, y: y};
}


/**
 * Converts pixel coord from old image to the new image.
 * @param {double} x x coordinate of the pixel
 * @param {double} y y coordinate of the pixel
 * @returns The updated position
 */
function convertToNewPixelCoords(x, y) {
    x -= (xPixel/2);
    y -= (yPixel/2);
    console.log(xPixel);
    console.log(yPixel);
    return {x: x, y: y};
}