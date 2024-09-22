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
     * @param {Page} page 
     * @returns {Promise<Map<String, String>>}
     */
    async scanRowForData(rowHandle, categoryInfo, page) {
        let tds = await rowHandle.$$('td');
        tds = await parsingUtility.removeDisplayNones(tds, page);
        let colArr = await parsingUtility.rowAsColspan(tds, page);
        console.log(`%cCol length: ${categoryInfo.colTotal}`, 'color: pink');
        let map = new Map();

        // We will iterate through colspan indices
        for (let i = 0; i < categoryInfo.colspans.length; i++) {
            let colIndex = categoryInfo.colspanAt(i).index;
            let span = categoryInfo.colspanAt(i).span;
            // console.log(`Colindex: ${colIndex}`);
            // Now that we know the index of the colspan and its length, we parse
            // all non-footnote TD's in there.

            let str = await this.parseColspan(colArr, colIndex, span, page);
            // We format for output
            str = parsingUtility.prepareStringForOutput(str);
            if (i == 0) {
                // console.log(`%c${categoryInfo.categoryAt(0)}: ${str}`, 'color:yellow');
            }
            // console.log(`${categoryInfo.categoryAt(i)}: '${str}'`);
            map.set(
                categoryInfo.categoryAt(i),
                str
            );
        }

        return map;
    }

    /**
     * 
     * @param {ElementHandle[]} colArr 
     * @param {Number} cIndex 
     * @param {Number} span aka colspan in the HTML
     * @param {Page} page 
     */
    async parseColspan(colArr, cIndex, span, page) {
        let str = '';
        for (let i = cIndex; i < cIndex + span; i++) {
            let td = colArr[i];
            if (td != null) {
                // console.log(`%cTd: ${td}`, 'color:yellow');
                let bit = await parsingUtility.parseTd(td, page);
                bit = parsingUtility.removeExtraSpaces(bit);
                str += bit;
            }
        }
        return str;
    }
}