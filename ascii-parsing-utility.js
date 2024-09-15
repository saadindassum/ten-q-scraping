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
     * Parses entire area of a column, past the underline.
     * @param {String} row 
     * @param {AsciiCategoryInfo} asciiInfo
     * @param {Number} index
     * @returns {String} data
     */
    parseTd(row, asciiInfo, index) {
        let sub;
        if (index + 1 > asciiInfo.getIndices().length) {
            sub = row.substring(asciiInfo.indexAt(index));
        } else {
            sub = row.substring(asciiInfo.indexAt(index), asciiInfo.indexAt(index + 1));
        }
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