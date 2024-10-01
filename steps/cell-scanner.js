import { AsciiCategoryInfo } from "../ten-q-objects.js";
import { AsciiUtility } from "../ascii-parsing-utility.js";
import { ParsingUtility } from "../parsing-utility.js";

let asciiUtility = new AsciiUtility();
let parsingUtility = new ParsingUtility();

export class CellScanner {
    constructor() { }

    /**
     * 
     * @param {String} sheet 
     * @param {AsciiCategoryInfo} asciiInfo
     * @returns {Map<String, any>[]} data with category string as key
     */
    barebones(sheet, asciiInfo) {
        let table = asciiUtility.getTable(sheet);
        let lines = table.split(/\r?\n|\r/);
        // We basically have a row-by-row table
        // And our ascii info is the key to figuring out where data is
        let data = new Array();
        for (let r = asciiInfo.getUlIndex() + 1; r < lines.length; r++) {
            let row = lines[r];
            let map = new Map();
            let ulIndex = asciiInfo.getUlIndex();
            for (let i = 0; i < asciiInfo.getCategories().length; i++) {
                let cellData = asciiUtility.parseTd(row, asciiInfo, i);
                cellData = parsingUtility.prepareStringForOutput(cellData);
                map.set(asciiInfo.categoryAt(i), cellData);
            }
            data.push(map);
        }
        return data;
    }
}