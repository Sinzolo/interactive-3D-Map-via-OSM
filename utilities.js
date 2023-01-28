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
        document.getElementById("loading").style.display = "block";
        currentLabel = document.getElementById("loading").innerHTML;
        document.getElementById("loading").innerHTML = currentLabel+".";
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
    document.getElementById("loading").style.display = "none";
    document.getElementById("loading").innerHTML = "Loading";
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
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const latDelta = (lat2 - lat1) * Math.PI / 180;
    const lngDelta = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(latDelta / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(lngDelta / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;
    return distance;
}