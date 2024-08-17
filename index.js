import puppeteer, { Browser } from 'puppeteer';

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
    console.log(searches[i]);
  }

//For now we're testing with just one browser.
await parseEdgarSearch(browser, searches[0]);

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
 * @returns {string} the title of the forms found.
 */
async function parseEdgarSearch(browser, search) {
  const page = await browser.newPage();
  // Navigate the page to a URL. Wait until the page is fully loaded.
  await page.goto(`https://www.sec.gov/edgar/search/#/dateRange=custom&category=custom&entityName=${search}&startdt=2004-01-01&enddt=2024-08-09&forms=10-Q`,
    { waitUntil: 'networkidle0' }
  );

  // Set screen size.
  await page.setViewport({width: 1080, height: 1024});

  //Here's the table containing all the forms. We'll get its element.
  const hits = await page.$$('#hits > table > tbody > tr');

  // console.log(`Hits length: ${hits.length}`);

  var firstHit = null;

  for (const hit of hits) {
    //For the moment, we're going to try logging file dates
    const fileDate = await page.evaluate(
      (el) => el.querySelector('td.filed').textContent,
      hit,
    );
    // console.log(fileDate);
    //Cool, now we wanna click through each filetype box.
    if (firstHit === null) {
      firstHit = hit;
    }
  }

  const hitHandle = await firstHit.$('td.filetype > a');
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
  await tenQUtility.parse10Q(browser, link);

  await page.close();

}



main();