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
        if (tds.length == categoryInfo.tdLength) {
            return await this.scanForMatchingCells(tds, categoryInfo, page);
        }
        return await this.scanForNonMatchingCells(tds, categoryInfo, page);
    }

    /**
     * For rows where the number of TD's matches what was found
     * in category info.
     * @param {ElementHandle} rowHandle 
     * @param {CategoryInfo} categoryInfo 
     * @param {Page} page 
     * @returns {Promise<Map>}
     */
    async scanForMatchingCells(tdHandles, categoryInfo, page) {
        let map = new Map();
        // This will help us see if the row stores a note and nothing else
        // If it does, we want to return a single key/value.
        let infoCount = 0;

        let firstText = '';
        let indexOfFirst = -1;

        // Since we have the indices of every category, we're going
        // to iterate using those.
        for (let i = 0; i < categoryInfo.getIndices().length; i++) {
            let currentHandle = tdHandles[categoryInfo.indexAt(i)];
            // let str = '\x1b[33mBLANK\x1b[39m';
            let str = await parsingUtility.parseTd(currentHandle, page);
            if (str.length > 0) {
                // Info was found in the cell
                // console.log(`Info found: ${str}`);
                if (!firstText) {
                    firstText = str;
                    indexOfFirst = i;
                }
                infoCount++;
            }
            // We format for output
            str = parsingUtility.prepareStringForOutput(str);
            // console.log(`${categoryInfo.categoryAt(i)}: '${str}'`);
            map.set(
                categoryInfo.categoryAt(i),
                str
            );
        }

        // console.log(`Info count: ${infoCount}`);
        if (infoCount < 2 && indexOfFirst == 0) {
            // console.log('NOTE DETECTED');
            map = new Map();
            firstText = parsingUtility.prepareStringForOutput(firstText);
            map.set('note', firstText);
        }
        return map;
    }

    /**
     * For rows where the number of TD's matches what was found
     * in category info.
     * @param {ElementHandle} rowHandle 
     * @param {CategoryInfo} categoryInfo 
     * @param {Page} page 
     * @returns {Promise<Map<String, String>>}
     */
    async scanForNonMatchingCells(tdHandles, categoryInfo, page) {
        let map = await this.scanForTotal(tdHandles, categoryInfo, page);
        if (map != null) {
            // console.log('RETURNING TOTAL MAP');
            // let categories = categoryInfo.getCategories();
            // let length = categories.length;
            // console.log(`${categories[length - 1]}: ${map.get(categories[length - 1])}`);
            return map;
        }
        map = new Map();
        // This will help us see if the row stores a note and nothing else
        // If it does, we want to return a single key/value.
        let infoCount = 0;

        let firstText = '';
        let indexOfFirst = -1;        

        // Since we have the indices of every category, we're going
        // to iterate using those.
        for (let i = 0; i < categoryInfo.getIndices().length; i++) {
            let currentHandle = tdHandles[categoryInfo.indexAt(i)];

            if (currentHandle == null) {
                map.set(
                    categoryInfo.categoryAt(i),
                    ''
                );
                break;
            }
            
            let str = await parsingUtility.parseTd(currentHandle, page);

            // console.log(`%c ${categoryInfo.indexAt(i)}: ${str}`, 'color: orange;');
            // Sometimes a $ is stored where the info should be, and the data is stored
            // in the neighbor td
            if (str === '$') {
                // Every $ adds an extra td, so we're going to remove
                // that td from our array, then go back.
                // console.error('$ DETECTED');
                tdHandles.splice(i, 1);
                i--;
                continue;
            }
            if (str.length == 0 && i > 1) {
                // Patterns I'm accounting for here
                // tend to pop up after the second category
                // for this microvar
                try {
                    const prevHandle = tdHandles[categoryInfo.indexAt(i) - 1];
                    const nextHandle = tdHandles[categoryInfo.indexAt(i) + 1];
                    const prev = await parsingUtility.parseTd(prevHandle, page);
                    const next = await parsingUtility.parseTd(nextHandle, page);
                    if (prev === '') {
                        if (next === '$' || next === ' ') {
                            // Pattern: two blanks then dollar
                            // Or three blanks in a row at a td where
                            // data is supposed to be.
                            // We're supposed to land in the middle one.
                            // console.error('SPSP$ DETECTED');
                            tdHandles.splice(i - 1, 2);
                        } else {
                            // console.error('BLBL DETECTED');
                            // Pattern: two blanks in a row
                            // where data is supposed to be.
                            tdHandles.splice(i, 1);
                        }
                        i--;
                        continue;
                    }
                } catch (e) {
                    // console.error(e);
                }
            }
            if (str) {
                // Info was found in the cell
                // console.log(`Info found: ${str}`);
                if (!firstText) {
                    firstText = str;
                    indexOfFirst = i;
                }
                infoCount++;
            }
            // We have to get rid of all commas
            str = parsingUtility.prepareStringForOutput(str);
            // Info or not, we add str to the map.
            // console.log(`%c${categoryInfo.categoryAt(i)}: '${str}'`, 'color:pink');
            map.set(
                categoryInfo.categoryAt(i),
                str
            );
        }

        // console.log(`Info count: ${infoCount}`);
        if (infoCount < 2 && indexOfFirst == 0) {
            // console.log('NOTE DETECTED');
            map = new Map();
            map.set('note', firstText);
        }
        return map;
    }

    /**
     * 
     * @param {ElementHandle[]} tdHandles 
     * @param {CategoryInfo} categoryInfo 
     * @param {Page} page 
     * @returns {Promise<Map<String, String>> | Promise<null>}
     */
    async scanForTotal(tdHandles, categoryInfo, page) {
        try {
            let map = new Map();
            let categories = categoryInfo.getCategories();
            let contentCount = await parsingUtility.countContent(tdHandles, page);
            // console.log(`%cContentCount: ${contentCount}`, 'color: grey');
            let subtotalDetected = await parsingUtility.detectSubtotalRow(tdHandles, page);
            if (contentCount == 2) {
                // console.log(`%cENTERING CONDITION`, 'color: yellow');
                // We're dealing with a total of cost and fair value, always the last two categories.
                // All this code is doing is setting those last two categories to that content.
                let contentParsed = 0;
                for (let i = 0; i < tdHandles.length; i++) {
                    if (contentParsed < contentCount) {
                        let str = await parsingUtility.parseTd(tdHandles[i], page);
                        if (str != null && str.length > 0) {
                            let subtraction = contentCount - contentParsed;
                            let cat = categories[categories.length - subtraction + 1];
                            str = parsingUtility.prepareStringForOutput(str);
                            // console.log(`%c${cat}: ${str}`, 'color: orange');
                            map.set(cat, str);
                            contentParsed--;
                        }
                    } else {
                        break;
                    }
                }
                for (let i = categories.length - 1 - contentCount; i >= 0; i--) {
                    let cat = categories[i];
                    // console.log(`%c${cat}: '${''}'`, 'color: red');
                    map.set(cat, '');
                }
                return map;
            } else if (subtotalDetected) {
                if (contentCount == 3) {
                    let contentParsed = 0;
                    for await (let td of tdHandles) {
                        let str = await parsingUtility.parseTd(td, page);
                        if (str != null && str.length > 0) {
                            let category = '';
                            switch (contentParsed) {
                                case 0:
                                    category = categories[0];
                                    break;
                                case 1:
                                    category = categories[categories.length - 2];
                                    break;
                                default:
                                    category = categories[categories.length - 1];
                                    break;
                            }
                            str = parsingUtility.prepareStringForOutput(str);
                            // console.log(`%c${category}: ${str}`, 'color: orange');
                            map.set(category, str);
                            contentParsed++;
                        }
                        if (contentParsed >= 3) {
                            break;
                        }
                    }
                    // Now we set all unused categories to blank
                    for (let i = 0; i < categories.length; i++) {
                        if (i != 0 && i < categories.length - 2) {
                            map.set(categories[i], '');
                        }
                    }
                } else {
                    throw new Error('Unimplemented case for subtotal');
                }
                return map;
            } else {
                return null;
            }
        } catch (e) {
            console.error(e);
            return null;
        }
    }

}