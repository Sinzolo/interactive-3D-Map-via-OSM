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
            retries--;
            console.log("Retrying, "+retries+" attempts left.");
        });
        await sleep(seconds);
        seconds *= 2;
    }
    document.getElementById("loading").style.display = "none";
    if (typeof response === 'undefined') throw new Error("All retries failed.");
    return response;
}

function debugLog(log) {
    if (debug == true) console.log(log);
}

/**
 * Sleep() returns a promise that resolves after a given number of seconds.
 * @param seconds - The number of seconds to sleep.
 * @returns A promise that will resolve after the specified number of seconds.
 */
function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, 1000*seconds));
}