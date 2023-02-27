'use strict';
importScripts("utilities.js");

self.onmessage = async function (e) {
    var overpassQuery = e.data.overpassQuery;
    var osmCacheName = e.data.osmCacheName;
    if (osmCacheName != null) {
        caches.match(overpassQuery)
            .then(async (response) => {
                if (response) {     // If found in cache return response
                    debugLog("Found it in cache! Fetch worker");
                    self.postMessage(await response.clone().text());
                }
                else {
                    this.postWithFetch(overpassQuery, osmCacheName);
                }
            });
    }
    else this.postWithFetch(overpassQuery);
}

async function postWithFetch(overpassQuery, osmCacheName = null) {
    self.postMessage(await fetchWithRetry(overpassQuery).then(async (response) => {
        if (osmCacheName != null) {
            caches.open(osmCacheName).then((cache) => {
                cache.put(overpassQuery, response);        //  Once fetched cache the response
                debugLog("Storing in cache Fetch worker");
            });
        }
        return await response.clone().text();
    }));
}