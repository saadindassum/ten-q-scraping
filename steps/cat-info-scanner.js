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
        let tds = await rowHandle.$$('td');
        console.log(`Before: ${tds}`);
        tds = await parsingUtility.removeDisplayNones(tds, page);
        console.log(`After: ${tds}`);
        let categories = new Array();
        let indices = new Array();
        let tdIndex = 0;
        for await (const tdHandle of tds) {
            let str = await parsingUtility.parseTd(tdHandle, page);
            if (str.length != 0) {
                indices.push(tdIndex);
                str = parsingUtility.removeExtraSpaces(str);
                categories.push(str);
            }
            tdIndex++;
        }
        if (categories.length == 0) {
            return null;
        }
        return new CategoryInfo(indices, categories, tds.length);
    }

    /**
     * 
     * @param {ElementHandle} rowHandle 
     * @param {CategoryInfo} categoryInfo
     * @param {Page} page 
     * @returns {Promise<CategoryInfo> | Promise<null>}
     */
    async scanRowForFromPreviousInfo(rowHandle, categoryInfo, page) {
        let tds = await rowHandle.$$('td');
        console.log(`Before: ${tds}`);
        tds = await parsingUtility.removeDisplayNones(tds, page);
        console.log(`After: ${tds}`);
        let categories = new Array();
        let indices = new Array();
        for await (const index of categoryInfo.getIndices()) {
            let tdHandle = tds[index];
            let str = await parsingUtility.parseTd(tdHandle, page);
            indices.push(index);
            str = parsingUtility.removeExtraSpaces(str);
            categories.push(str);
        }
        if (categories.length == 0) {
            return null;
        }
        return new CategoryInfo(indices, categories, tds.length);
    }
}