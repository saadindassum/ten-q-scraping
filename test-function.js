// So you don't have to write it again

/**
 * 
 * @param {String} url 
 */
async function test(url, cik, fileDate) {
    filingMap.set('link', url);
    filingMap.set('fileDate', fileDate);
    filingMap.set('cik', cik);
    console.log(`%c FINISHED TEST!`, 'color: green');

    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 4,
        timeout: 12000000,
        puppeteerOptions: {
            headless: false,
            args: [`--window-size=${1920},${1080}`],
        },
    });

    await initCluster(cluster);
    cluster.queue(filingMap);
    await cluster.idle();
}