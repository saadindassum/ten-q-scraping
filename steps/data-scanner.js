import { ElementHandle } from "puppeteer";
import { ParsingUtility } from "../parsing-utility.js";
import { RowScanner } from "./row-scanner.js";
import { CategoryInfo } from "../ten-q-objects.js";

const parsingUtility = new ParsingUtility();
const rowScanner = new RowScanner();

export class DataScanner {
    constructor() {}

    /**
     * 
     * @param {ElementHandle[]} rowHandles 
     * @param {CategoryInfo} categoryInfo
     * @param {Number} dataStartIndex 
     * @returns {Promise<Map<String, String>>} Table data
     */
    async scanTable(rowHandles, categoryInfo, dataStartIndex, page) {
        // Now, we make an array of data retrieved from the table.
        let data = new Array();
        let i = dataStartIndex;
        for (i; i < rowHandles.length; i++) {
            let blank = await parsingUtility.rowBlank(rowHandles[i], page);
            if (blank) {
                continue;
            }
            let rowData = await rowScanner.scanRowForData(rowHandles[i], categoryInfo, page);
            data.push(rowData);
        }
        return data;
    }
}