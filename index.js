import puppeteer, { Browser } from 'puppeteer';
import { TenQDoc } from './ten-q-objects.js';
import { TenQCollection } from './ten-q-objects.js';

// Or import puppeteer from 'puppeteer-core';

import fs from 'fs';
import readline from 'readline';
import TenQUtility from './10q.js';

async function main() {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    userDataDir: "./tmp",
    headless: false,
    setViewport: false,
  });
  // First we want the list of searches we'll be making
  // We have those stored at searches.txt
  const searches = await getLines('searches.txt');
  for (var i = 0; i < searches.length; i++) {
    var startTime = performance.now()
    console.log(searches[i]);
    try {
      let documentCollection = await parseEdgarSearch(browser, searches[0]);
      let outputString = documentCollection.toCsv();
      var endTime = performance.now();
      console.log(`Time for CIK ${searches[i]}: ${(endTime - startTime)/1000}s`);
      fs.writeFileSync(
        `./output/${searches[i]}.csv`,
        outputString
      );
    } catch (e) {
      console.error(e);
    }
    console.log('\n');
  }



await browser.close();

}

/**
 * Takes a filename outputs the file line by line as strings
 * @param {string[]} filename
 * @returns {string[]} Separated lines of the file
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
 * @returns {TenQCollection} the title of the forms found.
 */
async function parseEdgarSearch(browser, cik) {
  const page = await browser.newPage();

  // Navigate the page to a URL. Wait until the page is fully loaded.
  await page.goto(`https://www.sec.gov/edgar/search/#/dateRange=custom&category=custom&entityName=${cik}&startdt=2004-01-01&enddt=2024-08-09&forms=10-Q`,
    { waitUntil: 'domcontentloaded' }
  );

  //Here's the table containing all the forms. We'll get its element.
  const hits = await page.$$('#hits > table > tbody > tr');

  // console.log(`Hits length: ${hits.length}`);

  var firstHit = null;

  let formList = [];

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
  
    await page.waitForSelector('#open-file', {timeout: 10000});
    let link;
    while (!link) {
      const buttonHandle = await page.$('#open-file');
      // console.log('Button handle: ', buttonHandle);
      const jsonLink = await buttonHandle.getProperty('href');
      link = await jsonLink.jsonValue(); 
    }
  
    console.log(`Parsing filing page: ${link}`);
  
    const tenQUtility = new TenQUtility();
    const schedules = await tenQUtility.parse10Q(browser, link);
    
    const form = new TenQDoc(fileDate, schedules);
    formList.push(form);
  }

  // 

  await page.close();

  return new TenQCollection(cik, formList);

}



main();