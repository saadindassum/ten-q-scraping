import puppeteer, { Browser } from 'puppeteer';
import { TenQDoc } from './ten-q-objects.js';
import { TenQCollection } from './ten-q-objects.js';

// Or import puppeteer from 'puppeteer-core';

import fs from 'fs';
import readline from 'readline';
import TenQUtility from './10q.js';

async function main() {
  const browser = await puppeteer.launch({
    userDataDir: "./tmp",
    headless: false,
    setViewport: false,
  });
  // First we want the list of searches we'll be making
  // We have those stored at searches.txt
  const searches = await getLines('searches.txt');

  // To speed things up, we'll be doing five CIK's at a time
  // Once we fill up the array with 5 promises (or run out of CIK's)
  // we await Promise.all() 

  let promises = new Array();

  for (var i = 0; i < /*searches.length*/1; i++) {
    let cik = searches[i];
    //If we don't do this, we won't get any hits on EDGAR
    while (cik.length < 10) {
      cik = '0' + cik;
    }
    const promise = scrapeCik(browser, cik);
    promises.push(promise);
    if (promises.length > 2) {
      let results = await Promise.all(promises);
      for (const result of results) {
        console.log(result);
      }
      promises = new Array();
    }
  }
  if (promises.length > 0) {
    let results = await Promise.all(promises);
    for (const result of results) {
      console.log(result);
    }
  }

  await browser.close();
}

/**
 * Opens a browser and scrapes EDGAR for information about a CIK
 * and writes found data to a csv file.
 * @param {String} cik
 * @param {Browser} browser
 * @returns {Promise<Boolean>} success or failure.
 */
async function scrapeCik(browser, cik) {
  // Launch the browser and open a new blank page
  console.log('Attempting to parse ', cik);
  try {
    let documentCollection = await parseEdgarSearch(browser, cik);
    let outputString = documentCollection.toCsv();
    fs.writeFileSync(
      `./output/${cik}.csv`,
      outputString
    );
  } catch (e) {
    console.error(e);
    return false;
  }
  return true;
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
 * 
 * @param {Browser} browser 
 * @param {string} search
 * @returns {Promise<TenQCollection>} the title of the forms found.
 */
  async function parseEdgarSearch(browser, cik) {
  const page = await browser.newPage();

  // Navigate the page to a URL. Wait until the page is fully loaded.
  await page.goto(`https://www.sec.gov/edgar/search/#/dateRange=custom&category=custom&entityName=${cik}&startdt=2004-01-01&enddt=2024-08-09&forms=10-Q`,
    { waitUntil: 'networkidle0' }
  );

  //Here's the table containing all the forms. We'll get its element.
  const hits = await page.$$('#hits > table > tbody > tr');

  console.log(`Hits length: ${hits.length}`);

  let formList = [];
  const tenQUtility = new TenQUtility();

  for (const hit of hits) {
    //For the moment, we're going to try logging file dates
    const fileDate = await page.evaluate(
      (el) => el.querySelector('td.filed').textContent,
      hit,
    );
    //Cool, now we wanna click through each filetype box.
    const hitHandle = await hit.$('td.filetype > a');
    // console.log(hitHandle);
    hitHandle.click();
  
    await page.waitForSelector('#open-file', {timeout: 100000});
    let link;
    while (!link) {
      const buttonHandle = await page.$('#open-file');
      // console.log('Button handle: ', buttonHandle);
      const jsonLink = await buttonHandle.getProperty('href');
      link = await jsonLink.jsonValue(); 
    }
  
    console.log(`Parsing filing page: ${link}`);
  
    const schedules = await tenQUtility.parse10Q(browser, link);
    
    const form = new TenQDoc(fileDate, schedules, link);
    formList.push(form);
  }

  // 

  await page.close();

  return new TenQCollection(cik, formList);

}



main();