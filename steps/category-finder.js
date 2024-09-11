import { ParsingUtility } from "../parsing-utility.js";
import { AsciiCategoryInfo, CategoryInfo } from "../ten-q-objects.js";
import { AsciiUtility } from "../ascii-parsing-utility.js";

const parsingUtility = new ParsingUtility();
const asciiUtility = new AsciiUtility();

export class CategoryFinder {
    constructor() { }

    /**
     * 
     * @param {String} sheet the sheet containing the table.
     * @returns {AsciiCategoryInfo}
     */

    barebones(sheet) {
        // In a barebones 10Q, categories are underlined with dashed lines
        // Each category has a separate dash underline contained in a single string.
        // For an example, see (https://www.sec.gov/Archives/edgar/data/81955/000095015204004018/l06912ae10vq.txt).
        // We're going to separate the table by lines.
        // We scan for the underlines, and use that to find table columns.
        // And voila, we have all the info we need to find table cells.
        let table = asciiUtility.getTable(sheet);
        let lines = table.split(/\r?\n|\r/);
        let ulIndex = - 1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('---')) {
                ulIndex = i;
                break;
            }
        }
        let lengths = this.findBarebonesUnderlineLength(lines[ulIndex]);
        let indices = this.findBarebonesUnderlineIndices(lines[ulIndex]);
        let categories = this.findBarebonesCategories(table, indices, lengths);
        let catInfo = new AsciiCategoryInfo(indices, categories, lengths);
        return catInfo;
    };

    /**
     * 
     * @param {String} ulLine
     * @returns {Number[]} lengths
     */
    findBarebonesUnderlineLength(ulLine) {
        let temp = ulLine; // Because I'm afraid to mutate the thing.
        let strings = parsingUtility.splitBySpaces(temp);
        let lengths = new Array();
        for (let i = 0; i < strings; i++) {
            if (strings[i].length > 0) {
                lengths.push(strings[i].length);
            }
        }
        return lengths;
    }

    /**
     * @param {String} ulLine
     * @returns {Number[]} indices
     */
    findBarebonesUnderlineIndices(ulLine) {
        let detect = true;
        let indices = new Array();
        for (let i = 0; i < ulLine.length; i++) {
            if (ulLine.charAt(i) === '-' && detect) {
                indices.push(i);
                detect = false;
            }
            if (ulLine.charAt(i) === ' ') {
                detect = true;
            }
        }
        // console.log(indices);
        return indices;
    }

    /**
     * 
     * @param {String} table 
     * @param {Number[]} indices 
     * @param {Number[]} lengths
     * @returns {String[]} categories
     */
    findBarebonesCategories(table, indices, lengths) {
        // These things are contained in each line.
        // We parse each line until we hit the underline.
        let lines = table.split(/\r?\n|\r/);
        let categories = new Array();
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('---')) {
                break;
            }
            for (let j = 0; j < indices.length; j++) {
                // Get the substring
                let sub = lines[i].substring(indices[j], indices[j] + lengths[j]);

                // First we try to concatenate, if that goes wrong it means
                // we have no info.
                try {
                    let category = categories[i] + sub;
                    category = parsingUtility.removeExtraSpaces(category);
                    categories[i] = category;
                } catch (e) {
                    categories.push(sub);
                }
            }
        }
        return categories;
    }
}