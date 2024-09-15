import puppeteer, { Page } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import { TenQDoc } from './ten-q-objects.js';
import { TenQCollection } from './ten-q-objects.js';

// Or import puppeteer from 'puppeteer-core';

import fs from 'fs';
import readline from 'readline';
import TenQUtility from './10q.js';

async function main() {

  // First we want the list of searches we'll be making
  // We have those stored at searches.txt
  const searches = await getLines('searches.txt');

  // This time around we're using clusters
  // That will speed things up.
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

  for (var i = 0; i < searches.length; i++) {
    let cik = searches[i];
    //If we don't do this, we won't get any hits on EDGAR
    while (cik.length < 10) {
      cik = '0' + cik;
    }
    cluster.queue(cik);
  }

  // These have worked in the past
  // cluster.queue('0000017313');

  // These ones always get errors:
  // cluster.queue('0001383414');
  // cluster.queue('0001200934');
  // cluster.queue('0001099941');

  // Fix for maybe easy wins!
  // cluster.queue('0001515173'); //toISO problem, suspecting in date
  // cluster.queue('0001523526'); //toIso problem, suspecting in date
  // cluster.queue('0001143513');
  // cluster.quque('0001287750');
  // cluster.queue('0001487428');


  await cluster.idle();
  await cluster.close();

  console.log('%c Completed program!', 'color:green;');
}

/**
 * 
 * @param {String} url 
 */
async function test(url) {
  const browser = await puppeteer.launch(
    {
      headless: false,
      args: [`--window-size=${1920},${1080}`],
    }
  );

  const page = await browser.newPage();

  await testPage(page, url);

  await browser.close();
  console.log(`%c FINISHED TEST!`, 'color: green');
}

/**
 * Initializes our cluster to parse EDGAR and write to files.
 * @param {Cluster} cluster
 */
async function initCluster(cluster) {
  await cluster.task(async ({ page, data: cik }) => {
    try {
      let documentCollection = await parseEdgarSearch(page, cik);
      if (!documentCollection.hasData) {
        throw new Error(`No data found in CIK ${cik}`);
      }
      let outputString = documentCollection.toCsv();
      fs.writeFile(`./output/${cik}.csv`, outputString, err => {
        if (err) {
          // console.error(err);
        } else {
          // file written successfully
        }
      });
    } catch (e) {
      let str = '';
      str += e;
      try {
        fs.writeFileSync(
          `./output/${cik}.txt`,
          str
        );
      } catch (e) { }
      return false;
    }
  });
}

/**
 * Takes a filename outputs the file line by line as strings
 * @param {String[]} filename
 * @returns {Promise<String[]>} Separated lines of the file
*/
async function getLines(filename) {
  const fileStream = fs.createReadStream(filename);
  const lineScanner = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  let lines = new Array();
  for await (const line of lineScanner) {
    lines.push(line);
  }
  return lines;
}

/**
 * Outputs a CSV for a single page.
 * @param {Page} page 
 * @param {String} url 
 */
async function testPage(page, url) {
  const tenQUtility = new TenQUtility();
  const schedules = await tenQUtility.parse10Q(page, url);
  const tqDoc = new TenQDoc(Date.now(), schedules, url);
  const collection = new TenQCollection('TEST', [tqDoc]);
  try {
    let outputString = collection.toCsv();
    fs.writeFile(`./output/test.csv`, outputString, err => {
      if (err) {
        // console.error(err);
      } else {
        // file written successfully
      }
    });
  } catch (e) {
    console.error(e);
  }
}

/**
 * 
 * @param {Page} page 
 * @param {string} search
 * @returns {Promise<TenQCollection>} the title of the forms found.
 */
async function parseEdgarSearch(page, cik) {

  // Navigate the page to a URL. Wait until the page is fully loaded.
  await page.goto(`https://www.sec.gov/edgar/search/#/dateRange=custom&category=custom&entityName=${cik}&startdt=2004-01-01&enddt=2024-08-09&forms=10-Q`,
    { waitUntil: 'networkidle0' }
  );

  //Here's the table containing all the forms. We'll get its element.
  const hits = await page.$$('#hits > table > tbody > tr');

  // console.log(`Hits length: ${hits.length}`);

  let formList = [];
  const tenQUtility = new TenQUtility();

  // We can't be going back and forth from the search page
  // So first we collect every link

  let links = new Array();
  let fileDates = new Array();

  for (const hit of hits) {
    //For the moment, we're going to try logging file dates
    const fileDate = await page.evaluate(
      (el) => el.querySelector('td.filed').textContent,
      hit,
    );
    fileDates.push(fileDate);
    //Cool, now we wanna click through each filetype box.
    const hitHandle = await hit.$('td.filetype > a');
    // console.log(hitHandle);
    hitHandle.click();

    await page.waitForSelector('#open-file', { timeout: 10000 });
    let link;
    while (!link) {
      const buttonHandle = await page.$('#open-file');
      // console.log('Button handle: ', buttonHandle);
      const jsonLink = await buttonHandle.getProperty('href');
      link = await jsonLink.jsonValue();
    }
    links.push(link);
    // Now we have to close the preview page, so we find the button
    // for that
    await page.waitForSelector('#previewer > div > div > div.modal-header.border.border-0 > button', { timeout: 10000 });
    const closeHandle = await page.$('#previewer > div > div > div.modal-header.border.border-0 > button');
    try {
      await closeHandle.click();
    } catch (e) { }
    // We add a delay because this seems to be the most intensive
    // fetch, and where the SEC's most likely to block us.
    await delay(1000);
  }

  // And now we have a full list of 10Q links!
  for (let i = 0; i < links.length; i++) {

    // console.log(`Parsing filing page: ${links[i]}`);
    // console.log(`Link ${i}/${links.length}`);
    const schedules = await tenQUtility.parse10Q(page, links[i]);
    // console.log(`Schedules in: ${schedules}`);
    const form = new TenQDoc(fileDates[i], schedules, links[i]);
    formList.push(form);
  }

  // For testing
  // const schedules = await tenQUtility.parse10Q(page, 'https://www.sec.gov/Archives/edgar/data/1099941/000110465918016749/a18-7739_110q.htm');
  // console.log('successfully parsed schedules');
  // const form = new TenQDoc(Date(Date.now()), schedules, 'https://www.sec.gov/Archives/edgar/data/1099941/000110465918016749/a18-7739_110q.htm');
  // formList.push(form);

  await page.close();
  // console.log('Finished CIK ', cik);
  return new TenQCollection(cik, formList);

}

/**
 * Await this do add a delay
 * @param {Number} time 
 * @returns {Promise}
 */
async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}


// test('https://www.sec.gov/Archives/edgar/data/17313/000001731317000039/cswc-20170930x10q.htm');
main();