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
     * @returns {Promise<Map<String, any>>}
     */
    async scanRowForData(rowHandle, categoryInfo, page) {
        let tds = await rowHandle.$$('td');
        tds = await parsingUtility.removeDisplayNones(tds, page);
        let colArr = await parsingUtility.rowAsColspan(tds, page);
        // console.log(`%cCol length: ${categoryInfo.colTotal}`, 'color: pink');
        let map = new Map();
        let footnotes = new Array();

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

            // Deal with footnotes
            let footnote = await this.parseSpanFootnotes(colArr, colIndex, span, page);
            footnote = parsingUtility.replaceCommas(footnote, ';');
            footnote = parsingUtility.prepareStringForOutput(footnote);
            footnotes.push(footnote);
        }
        map.set('footnotes', footnotes);

        return map;
    }

    /**
     * 
     * @param {ElementHandle[]} colArr 
     * @param {Number} cIndex 
     * @param {Number} span aka colspan in the HTML
     * @param {Page} page 
     * @returns {Promise<String>} data
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

    /**
     * 
     * @param {ElementHandle[]} colArr 
     * @param {Number} cIndex 
     * @param {Number} span aka colspan in the HTML
     * @param {Page} page 
     * @returns {Promise<String>} footnotes
     */
    async parseSpanFootnotes(colArr, cIndex, span, page) {
        let str = '';
        for (let i = cIndex; i < cIndex + span; i++) {
            let td = colArr[i];
            if (td != null) {
                // console.log(`%cTd: ${td}`, 'color:yellow');
                let bit = await parsingUtility.parseFootnotes(td, page);
                bit = parsingUtility.removeExtraSpaces(bit);
                str += bit;
            }
        }
        return str;
    }
}