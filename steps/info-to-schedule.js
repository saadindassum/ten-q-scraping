import { Page } from "puppeteer";
import { ScheduleInfo, ScheduleOfInvestments } from "../ten-q-objects.js";
import { ParsingUtility } from "../parsing-utility.js";
import { CatInfoScanner } from "./cat-info-scanner.js";
import { DataScanner } from "./data-scanner.js";

const parsingUtility = new ParsingUtility();
const catInfoScanner = new CatInfoScanner();
const dataScanner = new DataScanner();

export class InfoToSchedule {
    constructor() {}

    /**
     * 
     * @param {ScheduleInfo} scheduleInfo 
     * @param {Page} page 
     * @returns {Promise<ScheduleOfInvestments>}
     */
    async convert(scheduleInfo, page) {
        if (scheduleInfo.tagName === 'TABLE') {
            return await this.fromTable(scheduleInfo, page);
        } else if (scheduleInfo.tagName === 'DIV') {
            let tableHandle = await scheduleInfo.containerHandle.$('div > table > tbody');
            if (tableHandle == null) {
                tableHandle = await scheduleInfo.containerHandle.$('div > table');
            }
            return await this.fromDiv(
                tableHandle,
                scheduleInfo.title,
                scheduleInfo.date,
                page
            );
        }

        throw new Error('Unimplemented info-to-schedule conversion');
    }

    /**
     * 
     * @param {ScheduleInfo} scheduleInfo 
     * @param {Page} page 
     * @returns {Promise<ScheduleOfInvestments>}
     */
    async fromTable(scheduleInfo, page) {
        let rowHandles = await scheduleInfo.containerHandle.$$('tr');
        let i = scheduleInfo.dataIndex;
        // First we want to figure out whether there's a separation row,
        // and once that's out of the way, we find category info.
        let categoryInfo = null;
        while (categoryInfo == null && i < rowHandles.length) {
            const blank = await parsingUtility.rowBlank(rowHandles[i], page);
            if (!blank) {
                categoryInfo = await catInfoScanner.scanRowForCategoryInfo(rowHandles[i], page);
            }
            i++;
        }

        let data = await dataScanner.scanTable(rowHandles, categoryInfo, i, page);

        // We should now have the data of every row.
        // And with that, everything for a schedule.

        const sched = new ScheduleOfInvestments(scheduleInfo.title, scheduleInfo.date, categoryInfo.getCategories(), data);
        // console.log('\n\nDATA:\n', data[0].get('note'), '\n\n');
        // console.log(sched.toCsv());
        return sched;
    }

    /**
    * 
    * For tables that have tables nested inside div
    * @param {ElementHandle} tableHandle
    * @param {Date} date
    * @param {Page} page
    * @returns {Promise<ScheduleOfInvestments>} or null.
    */
    async fromDiv(tableHandle, title, date, page) {
        var i = 0;
        const rows = await tableHandle.$$('tr');
        let rowHandles = new Array();
        for await (const rowHandle of rows) {
            rowHandles.push(rowHandle);
        }

        // We need to collect info until an underline is detected
        let underlineDetected = false;

        let categoryInfo;
        while (!underlineDetected) {
            const blank = await parsingUtility.rowBlank(rowHandles[i], page);
            if (!blank) {
                if (categoryInfo == null) {
                    categoryInfo = await catInfoScanner.scanRowForCategoryInfo(rowHandles[i], page);
                    console.log(categoryInfo.getCategories());
                } else {
                    // This means we've already parsed some category info
                    let newCategoryInfo = await catInfoScanner.scanRowForCategoryInfo(rowHandles[i], page);
                    for (let c = 0; c < newCategoryInfo.getCategories.length; c++) {
                        // C++. Ha.
                        // Concatenation time
                        let catName = categoryInfo.categoryAt(c);
                        if (catName.length > 0 && newCategoryInfo.categoryAt(c).length != 0) {
                            catName += ` ${newCategoryInfo.categoryAt(c)}`
                            categoryInfo.setCategoryAt(c, catName);
                        }
                    }
                    console.log(categoryInfo.getCategories());
                }
            }
            // Now we want to check for an underline.
            underlineDetected = await parsingUtility.rowHasUnderlines(rowHandles[i], page);
            i++;
        }

        console.log(`%c ${categoryInfo.getCategories()}`, 'color: yellow');

        let data = await dataScanner.scanTable(rowHandles, categoryInfo, i, page);
        // console.log(`%c GOT TO BOTTOM`, 'color: orange;');
        // console.log(`%c ${date.toISOString()}`, 'color: orange;');
        const sched = new ScheduleOfInvestments(title, date, categoryInfo.getCategories(), data);
        // console.log('\n\nDATA:\n', data[0].get('note'), '\n\n');
        // console.log(sched.toCsv());
        return sched;
    }
}