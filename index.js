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
    maxConcurrency: 3,
    timeout: 1200000,
    puppeteerOptions: {
      headless: false,
      args: [`--window-size=${1920},${1080}`],
    },
  });

  await initCluster(cluster);

  // for (var i = 0; i < searches.length; i++) {
  //   let cik = searches[i];
  //   //If we don't do this, we won't get any hits on EDGAR
  //   while (cik.length < 10) {
  //     cik = '0' + cik;
  //   }
  //   cluster.queue(cik);
  // }

  // These have worked in the past
  // cluster.queue('0000017313');

  // These ones always get errors:
  // cluster.queue('0001383414');
  // cluster.queue('0001200934');
  cluster.queue('0001099941');


  await cluster.idle();
  await cluster.close();
  console.log('%c Completed program!', 'color:green;');
}

/**
 * Initializes our cluster to parse EDGAR and write to files.
 * @param {Cluster} cluster
 */
async function initCluster(cluster) {
  await cluster.task(async ({ page, data: cik }) => {
    try {
      let documentCollection = await parseEdgarSearch(page, cik);
      let outputString = documentCollection.toCsv();
      fs.writeFile(`./output/${cik}.csv`, outputString, err => {
        if (err) {
          // console.error(err);
        } else {
          // file written successfully
        }
      });
    } catch (e) {
      console.log(`%c ERROR AT CIK ${cik}`, 'color: red;');
      console.error(e);
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

// /**
//  * Opens a browser and scrapes EDGAR for information about a CIK
//  * and writes found data to a csv file.
//  * @param {String} cik
//  * @param {Browser} browser
//  * @returns {Promise<Boolean>} success or failure.
//  */
// async function scrapeCik(browser, cik) {
//   // Launch the browser and open a new blank page
//   console.log('Attempting to parse ', cik);
//   try {
//     let documentCollection = await parseEdgarSearch(browser, cik);
//     let outputString = documentCollection.toCsv();
//     fs.writeFileSync(
//       `./output/${cik}.csv`,
//       outputString
//     );
//   } catch (e) {
//     console.error(e);
//     return false;
//   }
//   return true;
// }

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

  // for (const hit of hits) {
  //   //For the moment, we're going to try logging file dates
  //   const fileDate = await page.evaluate(
  //     (el) => el.querySelector('td.filed').textContent,
  //     hit,
  //   );
  //   fileDates.push(fileDate);
  //   //Cool, now we wanna click through each filetype box.
  //   const hitHandle = await hit.$('td.filetype > a');
  //   // console.log(hitHandle);
  //   hitHandle.click();

  //   await page.waitForSelector('#open-file', { timeout: 10000 });
  //   let link;
  //   while (!link) {
  //     const buttonHandle = await page.$('#open-file');
  //     // console.log('Button handle: ', buttonHandle);
  //     const jsonLink = await buttonHandle.getProperty('href');
  //     link = await jsonLink.jsonValue();
  //   }
  //   links.push(link);
  //   // Now we have to close the preview page, so we find the button
  //   // for that
  //   await page.waitForSelector('#previewer > div > div > div.modal-header.border.border-0 > button', { timeout: 10000 });
  //   const closeHandle = await page.$('#previewer > div > div > div.modal-header.border.border-0 > button');
  //   try {
  //     await closeHandle.click();
  //   } catch (e) { }
  //   // We add a delay because this seems to be the most intensive
  //   // fetch, and where the SEC's most likely to block us.
  //   await delay(500);
  // }

  // And now we have a full list of 10Q links!
  // for (let i = 0; i < links.length; i++) {

  //   // console.log(`Parsing filing page: ${links[i]}`);
  //   // console.log(`Link ${i}/${links.length}`);
  //   const schedules = await tenQUtility.parse10Q(page, links[i]);
  //   // console.log(`Schedules in: ${schedules}`);
  //   const form = new TenQDoc(fileDates[i], schedules, links[i]);
  //   formList.push(form);
  // }

  const schedules = await tenQUtility.parse10Q(page, 'https://www.sec.gov/Archives/edgar/data/1099941/000110465918016749/a18-7739_110q.htm');
  console.log('successfully parsed schedules');
  const form = new TenQDoc(Date(Date.now()), schedules, 'https://www.sec.gov/Archives/edgar/data/1099941/000110465918016749/a18-7739_110q.htm');
  formList.push(form);

  // 

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



main();