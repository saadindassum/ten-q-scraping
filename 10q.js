import { ElementHandle } from 'puppeteer';
import { CategoryInfo } from './ten-q-objects.js';
import ScheduleOfInvestments from './schedule-of-investments.js';
import { InvestmentSummary } from './schedule-of-investments.js';

export default class TenQ {
    constructor() {}

    /**
     * 
     * @param {Browser} browser an open browser to use
     * @param {string} link a link to the filing page
     */
    async parse10Q(browser, link) {
        const page = await browser.newPage();
        await page.goto(link, { waitUntil: 'networkidle0' });
        
        // What I figured out here is sometimes we have an organized htm file,
        // using tags in an organized way.
        // If we don't have that, THAT'S where the heavy lifting comes in.

        // 1. Try parsing as organized HTM
        // 2. If that fails, we parse as text document.

        const htmResults = await this.parseHtm(page);
        if (htmResults == null) {
            console.log('No tables found in document, so we parse manually.');
        }
    }

    /**
     * 
     * @param {Page} page the page we're parsing
     */
    async parseHtm(page) {
        // This will get all our tables.
        const tables = await page.$$('body > div > table > tbody');
        // console.log(`Tables found: ${tables.length}`);
        if (tables.length === 0) {
            return null;
        }
        // console.log(`${tables.length} table(s) found. Adding all schedules`);
        var tableIndex = 0;
        let tableInfo;
        for await (const tableHandle of tables) {
            tableInfo = await this.parseTable(tableHandle, page);
            if (tableInfo == null) {
                continue;
            }
        }
        return 2;
    }
    
    /**
     * 
     * @param {ElementHandle} tableHandle
     * @param {Page} page
     * @returns Map of the table with a title and a sub-map of investments,
     * or null for irrelevant tables.
     */
    async parseTable(tableHandle, page) {
        const rows = await tableHandle.$$('tr');
        // console.log(`Rows found in table: ${rows.length}`);

        // I want to make an array of row handles so we don't have to
        // await again, and we can iterate using a classic for loop.
        let rowHandles = new Array();
        for await (const rowHandle of rows) {
            rowHandles.push(rowHandle);
        }

        // This loop is going to get our title.
        // I'm noticing there's only one td in the title rows.
        // We can use that to determine whether the current row is a title
        // We don't apply that to row index 0 because it has a bunch of TD's
        // for no apparent reason.
        let title = '';
        let i = 0;
        for (i; i < rowHandles.length; i++) {
            const tds = await rowHandles[i].$$('td');
            if (tds.length > 1) {
                if (title.length != 0) {
                    //This means we already went into the other
                    //condition and are done reading the title.
                    //So we are done with the row.
                    break;
                }
                if (i != 0) {
                    break;
                }
            }
            else {
                for await (const tdHandle of tds) {
                    const spanHandle = await tdHandle.$('span');
                    let str;
                    try {
                        str = await page.evaluate(handle => handle.textContent, spanHandle);
                        if (str.length != 0) {
                            title += str;
                            title += '\n';
                        }
                    } catch (e) {
                        break;
                    }
                }
            }
        }

        const lcTitle = title.toLowerCase();
        if (!lcTitle.includes('schedule of')) {
            return null;
        }

        let tableInfo = new Map();
        tableInfo.set('title', title);
        console.log(`Match: ${title}`);

        // Since we kept track of the index and made an array of handles
        // We can continue right where we left off.

        // First we want to figure out whether there's a separation row,
        // and once that's out of the way, we find category info.

        let categoryInfo = null;
        while (categoryInfo == null && i < rowHandles.length) {
            const blank = await this.rowBlank(rowHandles[i], page);
            if (!blank) {
                categoryInfo = await this.getTableCategoryInfo(rowHandles[i], page);
            }
            i++;
        }

        // In theory, now we have category names, and their indices
        // AND i is right where the data starts.

        console.log(categoryInfo.getIndices());
        console.log(categoryInfo.getCategories());
    }

    /**
     * Parses the TD elements in the row, and returns true if none of them have text.
     * @param {ElementHandle} rowHandle 
     * @returns {boolean} Whether the row is empty or not
     */
    async rowBlank(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        for await (const tdHandle of tds) {
            try {
                const str = await page.evaluate(
                    (handle) => handle.querySelector('span').textContent,
                    tdHandle,
                  );
                if (str.length != 0) {
                    return false;
                }
            } catch (e) {
                // console.log('ERROR: ', e);
            }
        }
        return true;
    }
    
    /**
     * Gets categories for an organized 10Q document.
     * @param {ElementHandle} rowHandle
     * @returns {CategoryInfo} indices and categories.
     * "categories" contains the string name of the category, while
     * "indices" contains the actual indices of the categories.
     */
    async getTableCategoryInfo(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            const spanHandle = tdHandle.$('div > span');
            const str = '';
            try {
                str = await page.evaluate(
                    handle => handle.textContent,
                    spanHandle
                );
            } catch (e) {}
            if (str.length != 0) {
                indices.push(tdIndex);
                categories.push(str);
            }
            tdIndex++;
        }
        return new CategoryInfo(indices, categories);
    }
}