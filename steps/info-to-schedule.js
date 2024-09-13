import { Page } from "puppeteer";
import { ScheduleInfo, ScheduleOfInvestments } from "../ten-q-objects.js";
import { ParsingUtility } from "../parsing-utility.js";
import { CatInfoScanner } from "./cat-info-scanner.js";

const parsingUtility = new ParsingUtility();
const catInfoScanner = new CatInfoScanner();

export class InfoToSchedule {
    constructor() {}

    /**
     * 
     * @param {ScheduleInfo} scheduleInfo 
     * @param {Page} page 
     * @returns {Promise<ScheduleOfInvestments>}
     */
    async convert(scheduleInfo, page) {
        console.log('converting schedule info');
        if (scheduleInfo.tagName === 'TABLE') {
            return await this.fromTable(scheduleInfo, page);
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
        console.log('from table');
        let rowHandles = await scheduleInfo.containerHandle.$$('tr');
        let i = scheduleInfo.dataIndex;
        // First we want to figure out whether there's a separation row,
        // and once that's out of the way, we find category info.
        let categoryInfo = null;
        while (categoryInfo == null && i < rowHandles.length) {
            const blank = await parsingUtility.rowBlank(rowHandles[i], page);
            if (!blank) {
                categoryInfo = await catInfoScanner.scanRowForCategoryInfo(rowHandles[i], page);
            } else {
            }
            i++;
        }
        return null;

        let tableInfo = new Map();
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
}