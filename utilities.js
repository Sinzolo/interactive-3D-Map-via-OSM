'use strict';

const earthRadius = 6371e3;     // Earth's radius in metres
const radianFactor = Math.PI / 180;
const degreeFactor = 180 / Math.PI;

/**
 * "Try to fetch the URL, and if it fails, wait a bit and try again, doubling the wait time each time,
 * until it succeeds or we run out of retries."
 * 
 * The function takes two parameters: the URL to fetch, and the number of retries to attempt. The
 * default value for the number of retries is 10
 * @param url - The URL to fetch.
 * @param [retries=10] - The number of times to retry the fetch.
 * @returns A promise that resolves to a response object.
 */
async function fetchWithRetry(url, retries = 10) {
    let seconds = 1;
    var response;
    while (retries > 0) {
        response = await fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error("Fetch failed with status "+response.status);
            }
            retries = 0;
            return response;
        }).catch((error) => {
            console.log(error);
            retries--;
            console.log("Retrying, "+retries+" attempts left.");
        });
        await sleep(seconds);
        seconds *= 2;
    }
    if (typeof response === 'undefined') throw new Error("All retries failed.");
    return response;
}


function debugLog(log) {
    if (debug == true) console.log(log);
}


/**
 * A function that can be used to wait a set time.
 * To use this function type "await sleep(s)" with 's' being seconds.
 * @param seconds - The number of seconds to sleep.
 * @returns A promise that will resolve after the specified number of seconds.
 */
function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, 1000*seconds));
}


/**
 * It takes two coordinates, converts them to radians, calculates the difference between the two
 * coordinates, calculates the distance between the two coordinates, and returns the distance
 * @param coord1 - The first coordinate.
 * @param coord2 - The second coordinate.
 * @returns The distance between two coordinates in metres.
 */
function getDistance(coord1, coord2) {
    const [lat1, lng1] = coord1;
    const [lat2, lng2] = coord2;
    const lat1Rad = lat1 * radianFactor;
    const lat2Rad = lat2 * radianFactor;
    const latDelta = (lat2 - lat1) * radianFactor;
    const lngDelta = (lng2 - lng1) * radianFactor;
    const intermediate = Math.sin(latDelta / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(lngDelta / 2) ** 2;
    const distance = earthRadius * 2 * Math.atan2(Math.sqrt(intermediate), Math.sqrt(1 - intermediate));
    return distance;
}


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
    let latRadians = lat * radianFactor; // convert latitude to radians
    let latDelta = metres / earthRadius;  // calculate change in latitude
    let lngDelta = metres / (earthRadius * Math.cos(latRadians)); // calculate change in longitude

    return {
        minLat: lat - latDelta * degreeFactor,
        minLng: long - lngDelta * degreeFactor,
        maxLat: lat + latDelta * degreeFactor,
        maxLng: long + lngDelta * degreeFactor
    };
}

/**
 * Takes a coordinate and adds a distance to it.
 * 
 * @param start - A `{lat, long}` object
 * @param distance - The distance in meters
 * @param isLatitude - `true` if you want to add distance to the latitude, `false` if you want to add
 * distance to the longitude
 * @returns A new coordinate object with the new lat and long values
 */
function addDistance(start, distance, isLatitude) {
    const brng = isLatitude ? 0 : 90; // Bearing (0 for latitude, 90 for longitude)
    const radianLat = start.lat * radianFactor;
    const radianLong = start.long * radianFactor;

    const newLat = Math.asin(Math.sin(radianLat) * Math.cos(distance / earthRadius) + Math.cos(radianLat) * Math.sin(distance / earthRadius) * Math.cos(brng));
    const newLong = radianLong + Math.atan2(Math.sin(brng) * Math.sin(distance / earthRadius) * Math.cos(radianLat), Math.cos(distance / earthRadius) - Math.sin(radianLat) * Math.sin(newLat));

    return {
        lat: isLatitude ? parseFloat((newLat * degreeFactor).toFixed(6)) : start.lat,
        long: isLatitude ? start.long : parseFloat((newLong * degreeFactor).toFixed(6))
    };
}