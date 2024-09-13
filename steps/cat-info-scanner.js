import { ScheduleInfo, CategoryInfo } from "../ten-q-objects.js";
import { ParsingUtility } from "../parsing-utility.js";
import { ElementHandle, Page } from "puppeteer";

const parsingUtility = new ParsingUtility();

export class CatInfoScanner {
    constructor() { }

    /**
     * 
     * @param {ScheduleInfo} scheduleInfo 
     * @param {Page} page
     * @return {Promise<CategoryInfo>} 
     */
    async getCategoryInfo(scheduleInfo, page) {
        if (scheduleInfo.tagName == 'TABLE') {
            return await fromTable(scheduleInfo, page);
        }
        throw new Error('Unimplemented, could not find category info.');
    }

    /**
     * 
     * @param {ScheduleInfo} scheduleInfo 
     * @param {Page} page
     * @returns {Promise<CategoryInfo>} 
     */
    async fromTable(scheduleInfo, page) {
        if (scheduleInfo.date == null) {
            throw new Error('Unimplemented. Did not find date when searching category info');
        } else {
            return await this.fromSingleRow(scheduleInfo, page);
        }
    }

    /**
     * 
     * @param {ElementHandle} rowHandle 
     * @param {Page} page 
     * @returns {Promise<CategoryInfo> | Promise<null>}
     */
    async scanRowForCategoryInfo(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            let str = await parsingUtility.parseTd(tdHandle, page);
            if (str.length != 0) {
                indices.push(tdIndex);
                categories.push(str);
            }
            tdIndex++;
        }
        if (categories.length == 0) {
            return null;
        }
        return new CategoryInfo(indices, categories);
    }
}