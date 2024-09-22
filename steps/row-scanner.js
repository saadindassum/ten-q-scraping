import { ElementHandle } from "puppeteer";
import { ParsingUtility } from "../parsing-utility.js";
import { CategoryInfo } from "../ten-q-objects.js";

const parsingUtility = new ParsingUtility();

export class RowScanner {
    constructor() { }

    /**
     * Scans a row for SOI data
     * @param {ElementHandle} rowHandle 
     * @param {CategoryInfo} categoryInfo 
     * @param {String} companyMemory 
     * @param {Page} page 
     * @returns {Promise<Map<String, String>>}
     */
    async scanRowForData(rowHandle, categoryInfo, companyMemory, page) {
        let tds = await rowHandle.$$('td');
        tds = await parsingUtility.removeDisplayNones(tds, page);
        let colArr = await parsingUtility.rowAsColspan(tds, page);
        console.log(`%cCol length: ${categoryInfo.colTotal}`, 'color: pink');
        let map = new Map();

        // We will iterate through colspan indices
        for (let i = 0; i < categoryInfo.colspans.length; i++) {
            let colIndex = categoryInfo.colspanAt(i).index;
            // console.log(`Colindex: ${colIndex}`);
            //In theory our colArr should have the same length.
            let currentHandle = colArr[colIndex];
            // console.log(`Handle: ${currentHandle}`);
            // let str = '\x1b[33mBLANK\x1b[39m';
            let str = await parsingUtility.parseTd(currentHandle, page);
            // We format for output
            str = parsingUtility.prepareStringForOutput(str);
            if (i == 0) {
                console.log(`%c${categoryInfo.categoryAt(0)}: ${str}`, 'color:yellow');
            }
            // console.log(`${categoryInfo.categoryAt(i)}: '${str}'`);
            map.set(
                categoryInfo.categoryAt(i),
                str
            );
        }

        return map;
    }
}