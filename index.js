import puppeteer, { Page } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import { TenQDoc } from './ten-q-objects.js';
import { TenQCollection } from './ten-q-objects.js';

// Or import puppeteer from 'puppeteer-core';

import fs from 'fs';
import readline from 'readline';
import TenQUtility from './10q.js';

const tenQUtility = new TenQUtility();

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

  let skipList = getSkipList();
  console.log(`Skipping:\n${skipList}`);

  for (var i = 0; i < searches.length; i++) {
    let cik = searches[i];
    //If we don't do this, we won't get any hits on EDGAR
    while (cik.length < 10) {
      cik = '0' + cik;
    }
    if (!skipList.includes(cik)) {
      cluster.queue(cik);
    } else {
      console.log(`%c Skipped ${cik}`, 'color: grey');
    }
  }


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
      console.log(`%c Done parsing CIK ${cik}`, 'color: green');
    } catch (e) {
      let str = '';
      str += e;
      try {
        fs.writeFileSync(
          `./output/${cik}.txt`,
          str
        );
      } catch (e) { }
      console.error(`%c Failed to parse CIK ${cik}`);
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

/**
 * 
 * @returns {String[]}
 */
function getSkipList() {
  const testFolder = './output/';
  let fileNames = new Array()
  fs.readdirSync(testFolder).forEach(file => {
    let str = `${file}`;
    let split = str.split('.');
    fileNames.push(split[0]);
  });
  return fileNames;
}

/**
 * Takes a CIK, processes each filing as a document, and then merges them all into one document at the end.
 * Throws an error when encountering an unknown case.
 * 
 * @param {String} cik 
 */
async function pushthrough(cik) {

  const browser = await puppeteer.launch(
    {
      headless: false,
      args: [`--window-size=${1920},${1080}`],
    }
  );

  const page = await browser.newPage();

  const searches = await getLines('searches.txt');
  let skipList = getSkipList();

  for (var i = 0; i < searches.length; i++) {
    let cik = searches[i];
    //If we don't do this, we won't get any hits on EDGAR
    while (cik.length < 10) {
      cik = '0' + cik;
    }
    if (!skipList.includes(cik)) {
      await pushthroughEdgarSearch(page, cik);
    } else {
      console.log(`Skipped ${cik}`);
    }

  }

  // If we've reached this point, we've gone through all CIK's successfully.
  // We merge all files into one, throw that onto one string, and then place it under
  // one file in the output directory.
  // Finally, we recursively delete the directory for this CIK.

}

/**
 * Gets a skiplist for pushthrough
 * @param {String} cik 
 * @returns {Promise<Set<String>>}
 */
async function getFilingSkipSet(cik) {
  let dir = `./production/${cik}/`;
  if (!fs.existsSync(dir + 'skiplist.txt')) {
    // console.log(`${dir + 'skiplist.txt'} does not exist`);
    // console.log(`returning new set`);
    return new Set();
  }
  let set = new Set();
  let lines = await getLines(`./production/${cik}/skiplist.txt`);
  for (let line of lines) {
    // console.log(`Adding ${line} to set`);
    set.add(line);
  }
  return set;
}

/**
 * 
 * @param {String} url 
 * @param {String} cik
 */
function addFilingToSkipList(url, cik) {
  let dir = `./production/${cik}/`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  fs.appendFileSync(dir + 'skiplist.txt', `${url}\n`);
}

/**
 * 
 * @param {Page} page 
 * @param {string} search
 */
async function pushthroughEdgarSearch(page, cik) {

  let skipSet = await getFilingSkipSet(cik);

  // Navigate the page to a URL. Wait until the page is fully loaded.
  await page.goto(`https://www.sec.gov/edgar/search/#/dateRange=custom&category=custom&entityName=${cik}&startdt=2004-01-01&enddt=2024-08-09&forms=10-Q`,
    { waitUntil: 'networkidle0' }
  );

  //Here's the table containing all the forms. We'll get its element.
  const hits = await page.$$('#hits > table > tbody > tr');

  // console.log(`Hits length: ${hits.length}`);



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

    if (!skipSet.has(link)) {
      links.push(link);
    } else {
      console.log(`%c Skipped ${link}`, 'color: grey');
      // We have to remove this file date
      fileDates.splice(-1)
    }
    // Now we have to close the preview page, so we find the button
    // for that
    await page.waitForSelector('#previewer > div > div > div.modal-header.border.border-0 > button', { timeout: 10000 });
    const closeHandle = await page.$('#previewer > div > div > div.modal-header.border.border-0 > button');
    try {
      await closeHandle.click();
    } catch (e) { }
    // We add a delay because this seems to be the most intensive
    // fetch, and where the SEC's most likely to block us.
    await delay(250);
  }

  // And now we have a full list of 10Q links!
  for (let i = 0; i < links.length; i++) {

    console.log(`%cParsing filing page: ${links[i]}`, 'color:orange');
    // console.log(`Link ${i}/${links.length}`);
    const schedules = await tenQUtility.parse10Q(page, links[i]);
    // console.log(`Schedules in: ${schedules}`);
    const form = new TenQDoc(fileDates[i], schedules, links[i]);
    // Now we make a document for this filing.
    let dir = `./production/${cik}/`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    //For some reason, some filings share a date.
    //So we check if it exists, and then give it a number if it shares a date.
    let fileName = `${dir}${fileDates[i]}`
    while (fs.existsSync(fileName + '.csv')) {
      let split = fileName.split('_');
      if (split.length != 2) {
        // In this case we haven't added any numbers yet.
        fileName = fileName + '_1';
      } else {
        // We add one to the number. Just like Pro Tools does.
        let num = Number(split[1]);
        num++;
        fileName = split[0] + `_${num}`;
      }
    }
    fs.writeFileSync(
      fileName + '.csv',
      form.toCsv(),
    );
    addFilingToSkipList(links[i], cik);
    console.log(`%cParsed!`, 'color:green');
  }

  await page.close();
  console.log(`%cFINISHED CIK ${cik}`, 'color:green');

}

// main();
// test('https://www.sec.gov/Archives/edgar/data/17313/000114036113041116/form10q.htm');
pushthrough();