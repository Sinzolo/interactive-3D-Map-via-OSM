'use strict';

importScripts("utilities.js");

self.onmessage = async function (e) {
    console.log("THIS SHOULDNT BE UNDIFEINED: " + e.data.osmCacheName);
    var overpassQuery = e.data.overpassQuery;
    if (e.data.osmCacheName != null) {
        caches.match(overpassQuery)
            .then(async (response) => {
                if (response) {     // If found in cache return response
                    console.log("Found it in cache! Fetch worker");
                    self.postMessage(await response.clone().text());
                }
            });
        var osmCache = caches.open(e.data.osmCacheName);   // Opens a new cache with the given name
    }
    let test = await fetchWithRetry(overpassQuery).then(async (response) => {
        if (e.data.osmCacheName != null) {
            osmCache.then((cache) => {
                cache.put(overpassQuery, response);        //  Once fetched cache the response
                console.log("Storing in cache Fetch worker");
            });
        }
        return await response.clone().text();
    });
    self.postMessage(test);
}