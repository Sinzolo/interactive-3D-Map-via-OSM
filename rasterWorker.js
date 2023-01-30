'use strict';

try {
    // importScripts("https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js");
    importScripts("geotiff.min.js");
} catch {
    // If the browser doesn't support importScripts, then don't use web workers
    self.postMessage({ status: "bad" });
    self.close();
}

self.onmessage = async function (e) {
    let cpuCores = navigator.hardwareConcurrency;
    let pools = [new GeoTIFF.Pool(cpuCores / 2 - 1), new GeoTIFF.Pool(cpuCores / 2 - 1)];
    const [uniRaster, cityRaster] = await Promise.all([
        raster(e.data.uniURL, pools[0]),
        raster(e.data.cityURL, pools[1])
    ]);
    self.postMessage({ status: "ok", uniRaster, cityRaster });
    pools.forEach(pool => {
        pool.destroy();
    });
    // self.close();
}

function raster(url, pool) {
    return GeoTIFF.fromUrl(url).then((tiff) => {
        console.log(tiff.getImage());
        return tiff.getImage();
    }).then((image) => {
        console.log(image.readRasters({ pool }));
        return image.readRasters({ pool });
    });
}