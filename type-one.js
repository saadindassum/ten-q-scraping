import { ElementHandle, Page } from 'puppeteer';
import { CategoryInfo } from './ten-q-objects.js';
import { ScheduleOfInvestments } from './ten-q-objects.js';
import { ParsingUtility } from './parsing-utility.js';

var parsingUtility = new ParsingUtility();

export class TypeOne {
    constructor() {
    }
    /**
     * 
     * @param {Page} page the page we're parsing
     * @returns {Promise<ScheduleOfInvestments[]>} all the SOI's found in the page.
     */
    async parseHtm(page) {
        // console.log('Trying type 1.0');
        // This will get all our tables.
        const tables = await page.$$('body > div > table > tbody');
        // console.log(`Tables found: ${tables.length}`);
        if (tables.length === 0) {
            // console.log(`%cNO TABLES FOUND`, 'color: yellow;');
            return null;
        }
        // console.log(`${tables.length} table(s) found. Adding all schedules`);

        let scheduleList = new Array();

        let tableInfo;
        for await (const tableHandle of tables) {
            try {
                tableInfo = await this.parseTable(tableHandle, page);
            } catch (e) {
                // console.log('%c error caught while parsing table');
                // console.error(e);
                tableInfo = new ScheduleOfInvestments(
                    'ERROR TABLE',
                    new Date(Date.now()),
                    [],
                    []
                );
            }
            if (tableInfo == null) {
                continue;
            } else {
                // console.log(tableInfo.getTitle(), '\n');
                scheduleList.push(tableInfo);
            }
        }
        return scheduleList;
    }

    /**
     * 
     * @param {ElementHandle} tableHandle
     * @param {Page} page
     * @returns {Promise<ScheduleOfInvestments>} or null.
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
        let dateString = '';
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
                            // And this will make sure
                            // the date is saved. Ish.
                            dateString = str;
                        }
                    } catch (e) {
                        break;
                    }
                }
            }
        }
        const lcTitle = title.toLowerCase();
        if (!lcTitle.includes('schedule of investments')) {
            return null;
        }

        // console.log(`%c ${title}`, 'color:green;');

        // We get the date first
        // As a safety, if we fail to retrieve the date
        // We'll add the current date/time.
        let date = parsingUtility.getDate(dateString);
        // console.log(`Date: ${date.toUTCString()}`);

        let tableInfo = new Map();
        tableInfo.set('title', title);
        // console.log(`Match: ${title}`);

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

        //CONSISTENCY CHECKPOINT
        //Code reaches this point with no errors.
        // console.log('polo');

        // In theory, now we have category names, and their indices
        // AND i is right where the data starts.

        // console.log(categoryInfo.getIndices());
        // console.log(categoryInfo.getCategories());

        // Now, we make an array of data retrieved from the table.
        let data = new Array();
        for (i; i < rowHandles.length; i++) {
            let blank = await this.rowBlank(rowHandles[i], page);
            if (blank) {
                continue;
            }
            let rowData = await this.getRowInfo(rowHandles[i], categoryInfo, page);
            data.push(rowData);
        }

        // We should now have the data of every row.
        // And with that, everything for a schedule.

        const sched = new ScheduleOfInvestments(title, date, categoryInfo.getCategories(), data);
        // console.log('\n\nDATA:\n', data[0].get('note'), '\n\n');
        // console.log(sched.toCsv());
        return sched;
    }

    /**
     * Parses the TD elements in the row, and returns true if none of them have text.
     * @param {ElementHandle} rowHandle
     * @param {Page} page
     * @returns {Promise<Boolean>} Whether the row is empty or not
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
     * @returns {Promise<CategoryInfo>} indices and categories.
     * "categories" contains the string name of the category, while
     * "indices" contains the actual indices of the categories.
     */
    async getTableCategoryInfo(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            const spanHandle = await tdHandle.$('div > span');
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
     * Parses through a table and retrieves all text.
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
            let str = '';
            try {
                str = await page.evaluate(
                    (handle) => handle.querySelector('span').textContent,
                    currentHandle,
                );
            } catch (e) { }
            if (str.length > 0) {
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
        // console.log(map);
        return map;
    }
}