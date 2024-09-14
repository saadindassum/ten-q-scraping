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
}