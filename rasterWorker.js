'use strict';

try {
    // importScripts("https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js");
    // importScripts("./geotiff.min.js");
} catch (error) {
    // If the browser doesn't support importScripts, then don't use web workers
    self.postMessage({ status: "bad" });
    self.close();
}

self.onmessage = async function (e) {
    self.postMessage({ status: "bad" });    // No more height map
    self.close();
    // let cpuCores = navigator.hardwareConcurrency;
    //let pools = [new GeoTIFF.Pool(cpuCores / 2 - 1), new GeoTIFF.Pool(cpuCores / 2 - 1)];
    let [uniRaster, cityRaster] = await Promise.all([
        raster(e.data.uniURL),
        raster(e.data.cityURL)
    ]);
    self.postMessage({ status: "ok", uniRaster, cityRaster });
    // pools = null;
    // cpuCores = null;
    // [uniRaster, cityRaster] = [null, null];
    self.close();
}

function raster(url) {
    return GeoTIFF.fromUrl(url).then((tiff) => {
        return tiff.getImage();
    }).then((image) => {
        return image.readRasters();
    });
}