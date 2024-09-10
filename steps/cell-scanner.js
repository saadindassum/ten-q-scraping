import { AsciiCategoryInfo } from "../ten-q-objects.js";
import { AsciiUtility } from "../ascii-parsing-utility.js";

let asciiUtility = new AsciiUtility();

export class CellScanner {
    constructor() { }

    /**
     * 
     * @param {String} sheet 
     * @param {AsciiCategoryInfo} asciiInfo
     * @returns {Map<String, String>[]} data with category string as key
     */
    barebones(sheet, asciiInfo) {
        let table = asciiUtility.getTable(sheet);
        let lines = table.split(/\r?\n|\r/);
        // We basically have a row-by-row table
        // And our ascii info is the key to figuring out where data is
        let data = new Array();
        for (let row of lines) {
            let map = new Map();
            for (let i = 0; i < asciiInfo.getCategories().length; i++) {
                cellData = asciiUtility.parseTd(row, asciiInfo.indexAt(i), asciiInfo.lengthAt(i));
                map.set(asciiInfo.categoryAt(i), cellData);
            }
            data.push(map);
        }
        return data;
    }
}