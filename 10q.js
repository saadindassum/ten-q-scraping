import { Page } from 'puppeteer';
import { ScheduleOfInvestments } from './ten-q-objects.js';
import { TypeTwoOne } from './type-two-one.js';

/**
 * A class which will handle choosing which variation to try parsing with.
 * All that should be done in this class is try a variation, and then try
 * other variations if results came up null.
 */
export default class TenQUtility {
    constructor() { }

    /**
     * 
     * @param {Page} page the page to use
     * @param {string} link a link to the filing page
     * @returns {Promise<ScheduleOfInvestments[]>} a list of a schedule of investments.
     */
    async parse10Q(page, link) {
        console.log(`Parsing link ${link}`);
        await page.goto(link, { waitUntil: 'networkidle0' });

        // What I figured out here is sometimes we have an organized htm file,
        // using tags in an organized way.
        // If we don't have that, THAT'S where the heavy lifting comes in.

        // 1. Try parsing as organized HTM
        // 2. If that fails, we parse as text document.

        let typeTwo = new TypeTwoOne();

        let htmResults = await typeTwo.parseDocument(page);
        if (htmResults === null || htmResults.length == 0) {
            htmResults = this.parseHtm(page);
        }
        if (htmResults === null || htmResults.length == 0) {
            // console.log(`%cNO RESULTS FOUND IN LINK ${link}`, 'color: red;');
            return [];
        }
        // console.log(`%c ${htmResults}`, 'color: orange');
        console.log(`%cRESULTS FOUND IN ${link}`, 'color: green;');
        return htmResults;
    }
}