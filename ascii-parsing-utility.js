import { AsciiCategoryInfo } from "./ten-q-objects.js";
import { ParsingUtility } from "./parsing-utility.js";

const parsingUtility = new ParsingUtility();

export class AsciiUtility {
    constructor() { }

    /**
     * 
     * @param {String} rawString 
     * @returns {String[]} the string split by people
     */
    splitPages(rawString) {
        return rawString.split('<PAGE>');
    }
    
    /**
     * 
     * @param {String} row 
     * @param {Number} catIndex
     * @param {Number} catLength
     * @param {Number} rangeIndex
     * @returns {String} data
     */
    parseTd(row, catIndex, catLength) {
        let sub = row.substring(catIndex, catIndex + catLength);
        sub = parsingUtility.removeExtraSpaces(sub);
        return sub;
    }

    /**
     * 
     * @param {String} sheet
     * @returns {String} the section of the sheet containing the table
     */
    getTable(sheet) {
        let table = sheet.split('<TABLE>')[1];
        return table;
    }
    
}