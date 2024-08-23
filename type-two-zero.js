import { ElementHandle, Page } from 'puppeteer';
import { CategoryInfo } from './ten-q-objects.js';
import { ScheduleOfInvestments } from './ten-q-objects.js';
import { ParsingUtility } from './parsing-utility.js';

var parsingUtility = new ParsingUtility();

/**
 * Type Two, microvariation one
 */
export class TypeTwoZero {
    constructor() { }

    /**
         * 
         * @param {Page} page the page we're parsing
         * @returns {Promise<ScheduleOfInvestments[]>} all the SOI's found in the page.
         */
    async parseDocument(page) {
        // This will get all our tables.
        let divs = await page.$$('body > div');
        // console.log(`Divs found: ${divs.length}`);
        if (divs.length === 0) {
            divs = await page.$$('body > document > type > sequence > filename > description > text > div');
        }
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
        const pHandles = await divHandle.$$('p');

        // We get the title, we check if it's a schedule
        // For this type, we stop when we hit a date
        let title = '';
        let date;
        // And we want to know that 
        let divs = new Array();

        for (const pHandle of pHandles) {
            const str = await this.parseP(pHandle, page);
            let noSpace = '';
            if (str) {
                noSpace = parsingUtility.removeNonAlphanumeric(str);
            }
            if (noSpace.length > 0) {
                title += str;
                //Because the date always comes last.
                let dateString = str;
            }
            try {
                let potentialDate = parsingUtility.getDate(dateString);
                if (potentialDate.toString() != 'Invalid Date') {
                    date = potentialDate;
                    break;
                }
            } catch (e) { }
        }

        const lcTitle = title.toLowerCase();
        if (!lcTitle.includes('schedule of') || title.length > 750) {
            return null;
        }
        console.log(title);
        // console.log(`%c TITLE LENGTH: ${title.length}`, 'color: orange;');

        // Table is inside yet another div
        const tableHandle = await divHandle.$('div > table');
        if (tableHandle == null) {
            return null;
        }
        let schedule = await this.parseTable(tableHandle, title, date, page);
        return schedule;
    }

    /**
    * 
    * For tables that have tables nested inside div
    * @param {ElementHandle} tableHandle
    * @param {Date} date
    * @param {Page} page
    * @returns {Promise<ScheduleOfInvestments>} or null.
    */
    async parseTable(tableHandle, title, date, page) {
        let i = 0;
        const rows = await tableHandle.$$('tr');
        let rowHandles = new Array();
        for await (const rowHandle of rows) {
            rowHandles.push(rowHandle);
        }

        // We need to collect info until an underline is detected
        let underlineDetected = false;

        let categoryInfo;
        while (!underlineDetected) {
            const blank = await this.rowBlank(rowHandles[i], page);
            if (!blank) {
                if (categoryInfo == null) {
                    categoryInfo = await this.getTableCategoryInfo(rowHandles[i], page);
                } else {
                    // This means we've already parsed some category info
                    let newCategoryInfo = await this.getTableCategoryInfo(rowHandles[i], page);
                    for (let c = 0; c < newCategoryInfo.getCategories.length; c++) {
                        // C++. Ha.
                        // Concatenation time
                        let catName = categoryInfo.categoryAt(c);
                        catName += ` ${newCategoryInfo.categoryAt(c)}`
                        categoryInfo.setCategoryAt(c, catName);
                    }
                }
            }
            // Now we want to check for an underline.
            underlineDetected = await parsingUtility.rowHasUnderlines(rowHandles[i], page);
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
        // console.log(`%c GOT TO BOTTOM`, 'color: orange;');
        // console.log(`%c ${date.toISOString()}`, 'color: orange;');
        const sched = new ScheduleOfInvestments(title, date, categoryInfo.getCategories(), data);
        // console.log('\n\nDATA:\n', data[0].get('note'), '\n\n');
        // console.log(sched.toCsv());
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
        // console.log(categoryInfo.getCategories());
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
        // console.log(`%c ${categoryInfo.getIndices()}`, 'color: yellow;');
        for (let i = 0; i < categoryInfo.getIndices().length; i++) {
            let currentHandle = tdHandles[categoryInfo.indexAt(i)];
            // let str = '\x1b[33mBLANK\x1b[39m';
            if (currentHandle == null) {
                map.set(
                    categoryInfo.categoryAt(i),
                    ''
                );
                break;
            }
            let str = await this.parseTd(currentHandle, page);

            // console.log(`%c ${categoryInfo.indexAt(i)}: ${str}`, 'color: orange;');
            // Sometimes a $ is stored where the info should be, and the data is stored
            // in the neighbor td
            if (str === '$') {
                // Every $ adds an extra td, so we're going to remove
                // that td from our array, then go back.
                // console.error('$ DETECTED');
                tdHandles.splice(i, 1);
                i--;
                continue;
            }
            if (str.length == 0 && i > 1) {
                // Patterns I'm accounting for here
                // tend to pop up after the second category
                // for this microvar
                try {
                    const prevHandle = tdHandles[categoryInfo.indexAt(i) - 1];
                    const nextHandle = tdHandles[categoryInfo.indexAt(i) + 1];
                    const prev = await this.parseTd(prevHandle, page);
                    const next = await this.parseTd(nextHandle, page);
                    if (prev === '') {
                        if (next === '$' || next === ' ') {
                            // Pattern: two blanks then dollar
                            // Or three blanks in a row at a td where
                            // data is supposed to be.
                            // We're supposed to land in the middle one.
                            // console.error('SPSP$ DETECTED');
                            tdHandles.splice(i - 1, 2);
                        } else {
                            // console.error('BLBL DETECTED');
                            // Pattern: two blanks in a row
                            // where data is supposed to be.
                            tdHandles.splice(i, 1);
                        }
                        i--;
                        continue;
                    }
                } catch (e) {
                    // console.error(e);
                }
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
            str = str.replace('$', '');
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
                let str = await this.parseTd(tdHandle, page);
                // console.log(`BLANK CHECK: \'${str}\'`);
                if (str != null && str.length != 0) {
                    // console.log('%c NOT BLANK', 'color: green;');
                    return false;
                } else {
                    // console.log('%c BLANK', 'color: orange;');
                }
            } catch (e) {
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

        let bottomBorderDetected = false;
        const tds = await rowHandle.$$('td');
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            let str = await this.parseTd(tdHandle, page);
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
            if (!str) {
                str = await page.evaluate(
                    (handle) => handle.querySelector('font').textContent,
                    pHandle,
                );
            }
        } catch (e) {
            return null;
        }
        if (str == '&nbsp;') {
            return '';
        }
        return str;
    }

    /**
     * Extracts the last valid date listed in in a row.
     * @param {ElementHandle} rowHandle 
     * @param {Page} page
     * @returns {Promise<Date>}
     */
    async extractScheduleDateFromRow(rowHandle, page) {
        // console.log('%c EXTRACTING DATE FROM ROW', 'color: yellow;');
        let tdHandles = await rowHandle.$$('td');
        let str;
        for await (const tdHandle of tdHandles) {
            const newStr = await this.parseTd(tdHandle, page);
            // console.log(newStr);
            if (newStr.length > 0) {
                str = newStr;
            }
        }
        if (str.length == 0) {
            return null;
        }
        let date = parsingUtility.getDate(str);
        // console.log(`%c RESULT DATE: ${date.toISOString()}`, 'color: yellow;');
        return date;
    }

    /**
     * Extracts text for TD handle of all known variations of Td
     * @param {ElementHandle} tdHandle 
     * @param {Page} page 
     * @returns {Promise<String>}
     */
    async parseTd(tdHandle, page) {
        let str = '';
        try {
            str = await page.evaluate(
                handle => handle.textContent,
                tdHandle
            );
        } catch (e) { }
        if (str.length == 0 || str == null) {
            // console.log('%c trying micro variation', 'color: yellow;');
            let bHandle = await tdHandle.$('b');
            if (bHandle != null) {
                try {
                    str = await page.evaluate(
                        handle => handle.textContent,
                        bHandle
                    );
                } catch (e) {
                    console.error(e);
                }
            }
        }
        if (str === '$') {
            // In this case we don't want to strip it of alphanumerics
            // We want to detect it. Let's return it.
            return str;
        }
        let noSpace = str;
        noSpace = parsingUtility.removeNonAlphanumeric(noSpace);
        // console.log(`NOSPACE:${noSpace}\nlength: ${noSpace.length}`);
        if (noSpace.length == 0) {
            return noSpace;
        }
        return str;
    }
}