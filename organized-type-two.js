import { ElementHandle, Page } from 'puppeteer';
import { CategoryInfo } from './ten-q-objects.js';
import { ScheduleOfInvestments } from './ten-q-objects.js';
import { ParsingUtility } from './parsing-utility.js';

var parsingUtility = new ParsingUtility();

/**
 * For parsing 10Qs where tables are wrapped in divs
 */
export class OrganizedTypeTwo {
    constructor() { }

    /**
         * 
         * @param {Page} page the page we're parsing
         * @returns {Promise<ScheduleOfInvestments[]>} all the SOI's found in the page.
         */
    async parseDocument(page) {
        // This will get all our tables.
        const divs = await page.$$('body > document > type > sequence > filename > description > text > div');
        console.log(`Divs found: ${divs.length}`);
        if (divs.length === 0) {
            console.log(`%cNO DIVS FOUND`, 'color: yellow;');
            return null;
        }
        console.log(`${divs.length} div(s) found. Adding all schedules`);

        let scheduleList = new Array();

        for await (const divHandle of divs) {
            let sched = await this.parseDiv(divHandle, page);
            if (sched) {
                scheduleList.push(sched);
            }
        }

        return scheduleList;
    }

    /**
     * For 10Qs where the table titles are in a div
     * @param {ElementHandle} divHandle
     * @param {Page} page
     * @returns {Promise<ScheduleOfInvestments>}
     */
    async parseDiv(divHandle, page) {
        const pHandles = await divHandle.$$('p > font');

        // We get the title, we check if it's a schedule
        let title = '';
        let dateString = '';
        // And we want to know that 
        let divs = new Array();

        for (const pHandle of pHandles) {
            try {
                const str = await this.parseP(pHandle, page);
                if (str) {
                    title += str;
                    //Because the date always comes last.
                    dateString = str;
                }
            } catch (e) {
                break;
            }
        }
        console.log('TITLE: ', title);
        const lcTitle = title.toLowerCase();
        if (!lcTitle.includes('schedule of')) {
            return null;
        }
        console.log('FOUND SCHEDULE!');
        console.log(`%c ${title}`, 'color: green;');

        let date = parsingUtility.getDate();

        // Table is inside yet another div
        const tableHandle = divHandle.$$('div > table');
        let data = await this.parseTable(tableHandle, page);
        data.set('title', title);

        return data;
    }

    /**
    * 
    * For tables that have tables nested inside div
    * @param {ElementHandle} tableHandle
    * @param {Date} date
    * @param {Page} page
    * @returns {Promise<Map<String, String>>} or null.
    */
    async parseTable(tableHandle, title, date, page) {
        // Tells us whether we're dealing with the known microvariation
        let microvar = (date == null);
        let i = 0;
        const rows = await tableHandle.$$('tr');
        let rowHandles = new Array();
        for await (const rowHandle of rows) {
            rowHandles.push(rowHandle);
        }

        // There's a micro variation where the date
        // is in the top row of the table.
        // We must account for that.

        let tableInfo = new Map();
        let categoryInfo = null;
        while ((!categoryInfo || !date) && i < rowHandles.length) {
            const blank = await this.rowBlank(rowHandles[i], page);
            if (!blank) {
                if (!date) {
                    date = this.extractScheduleDateFromRow(rowHandles[i], page);
                } else {
                    categoryInfo = await this.getTableCategoryInfo(rowHandles[i], page);
                }
            }
            i++;
        }
        let data = new Array();
        for (i; i < rowHandles.length; i++) {
            let blank = await this.rowBlank(rowHandles[i], page);
            if (blank) {
                continue;
            }
            let rowData = await this.getRowInfo(rowHandles[i], categoryInfo, page);

            data.push(rowData);
        }
        const sched = new ScheduleOfInvestments(title, date, categoryInfo.getCategories(), data);
        // console.log('\n\nDATA:\n', data[0].get('note'), '\n\n');
        console.log(sched.toCsv());
        return sched;
    }

    /**
     * Parses through a table and retrieves all categories.
     * @param {ElementHandle} rowHandle 
     * @param {CategoryInfo} categoryInfo 
     * @param {Page} page 
     * @returns {Promise<Map<String, String>>}
     */
    async getRowInfo(rowHandle, categoryInfo, page) {
        let map = new Map();
        // This will help us see if the row stores a note and nothing else
        // If it does, we want to return a single key/value.
        let infoCount = 0;

        let firstText = '';
        let indexOfFirst = -1;

        // We create an array of TD's so we can iterate with an index.
        let tdHandles = new Array();
        let tds = await rowHandle.$$('td');
        for await (const tdHandle of tds) {
            tdHandles.push(tdHandle);
        }

        // Since we have the indices of every category, we're going
        // to iterate using those.
        for (let i = 0; i < categoryInfo.getIndices().length; i++) {
            let currentHandle = tdHandles[categoryInfo.indexAt(i)];
            // let str = '\x1b[33mBLANK\x1b[39m';
            let str = await this.parseTd(currentHandle);
            // Sometimes a $ is stored where the info should be, and the data is stored
            // in the neighbor td
            if (str == '$') {
                currentHandle = tdHandles[categoryInfo.indexAt(i) + 1];
            }
            if (str) {
                // Info was found in the cell
                // console.log(`Info found: ${str}`);
                if (!firstText) {
                    firstText = str;
                    indexOfFirst = i;
                }
                infoCount++;
            }
            // We have to get rid of all commas
            str = str.replace(',', '');
            str = str.replace('$');
            // Info or not, we add str to the map.
            map.set(
                categoryInfo.categoryAt(i),
                str
            );
        }

        // console.log(`Info count: ${infoCount}`);
        if (infoCount < 2 && indexOfFirst == 0) {
            // console.log('NOTE DETECTED');
            map = new Map();
            map.set('note', firstText);
        }
        // console.log(map);
        return map;
    }

    /**
     * Checks if div table row is blank
     * @param {ElementHandle} rowHandle 
     * @param {Page} page 
     */
    async rowBlank(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        for await (const tdHandle of tds) {
            try {
                const str = await this.parseTd(tdHandle, page);
                if (!str) {
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
     * @returns {Promise<CategoryInfo>} indices and categories.
     * "categories" contains the string name of the category, while
     * "indices" contains the actual indices of the categories.
     */
    async getTableCategoryInfo(rowHandle, page) {
        // TODO: finish implementing
        // right now we're looking at the micro variation.
        // Like the title, each category is spread across different rows.
        // One way we can tell it's ended is by an underline

        // border-bottom:1pt solid #000000
        // That's what it looks like
        // We want to get the style attribute, and check if it contains
        // That string

        let bottomBorderDetected = false;
        const tds = await rowHandle.$$('td');
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            const spanHandle = await tdHandle.$('p > font');
            let str = '';
            try {
                str = await page.evaluate(
                    handle => handle.textContent,
                    spanHandle
                );
            } catch (e) {
            }
            if (str.length != 0) {
                indices.push(tdIndex);
                categories.push(str);
            }
            tdIndex++;
        }
        return new CategoryInfo(indices, categories);
    }

    /**
     * For the micro variation
     * @param {ElementHandle} rowHandle 
     * @param {Page} page
     * @returns {CategoryInfo}
     */
    async getMicrovarCategoryInfo(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            const bHandle = await tdHandle.$('b');
            let str;
            try {
                str = await page.evaluate(
                    handle => handle.textContent,
                    bHandle
                );
            } catch (e) {
            }
            if (str) {
                indices.push(tdIndex);
                categories.push(str);
            }
            tdIndex++;
        }
        return new CategoryInfo(indices, categories);
    }

    /**
     * Organized 10Q's that keep the tables and titles
     * within a div seem to have two micro-variations.
     * One is text within a p, the other is text within
     * a p font. This method figures out which one.
     * @param {ElementHandle} eHandle 
     * @param {Page} page
     * @returns {Promise<String>} text content.
     */
    async extractText(eHandle, page) {
        let str;
        try {
            str = await page.evaluate(
                (handle) => handle.querySelector('p').textContent,
                eHandle,
            );
            if (!str) {
                str = await page.evaluate(
                    (handle) => handle.querySelector('p > font').textContent,
                    eHandle,
                );
            }
        } catch (e) {
            return null;
        }
        return str;
    }

    /**
     * Same as extract text but for p handles.
     * @param {ElementHandle} pHandle 
     * @param {Page} page
     * @returns {Promise<String>} text content.
     */
    async parseP(pHandle, page) {
        let str;
        try {
            str = await page.evaluate(
                (handle) => handle.textContent,
                pHandle,
            );
            console.log(str);
            if (!str) {
                str = await page.evaluate(
                    (handle) => handle.querySelector('font').textContent,
                    pHandle,
                );
                console.log(str);
            }
        } catch (e) {
            return null;
        }
        console.log('parsed string: ', str);
        return str;
    }

    /**
     * Extracts the last valid date listed in in a row.
     * @param {ElementHandle} rowHandle 
     * @param {Page} page
     * @returns {Promise<Date>}
     */
    async extractScheduleDateFromRow(rowHandle, page) {
        let tdHandles = await rowHandle.$$('td');
        let str;
        for await (const tdHandle of tdHandles) {
            str = await parseTd(tdHandle, page);
        }
        if (!str) {
            return null;
        }
        let date = parsingUtility.getDate(str);
        return date;
    }

    /**
     * Extracts text for TD handle of all known variations of Td
     * @param {ElementHandle} tdHandle 
     * @param {Page} page 
     */
    async parseTd(tdHandle, page) {
        let str;
        try {
            str = await page.evaluate(
                handle => handle.textContent,
                tdHandle
            );
        } catch (e) { }
        if (!str) {
            str = await page.evaluate(
                handle => handle.querySelector('b').textContent,
                tdHandle
            );
        }
        return str;
    }
}