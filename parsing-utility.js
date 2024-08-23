import { ElementHandle, Page } from 'puppeteer';

export class ParsingUtility {
    constructor() { }

    /**
     * 
     * @param {String} dateString
     * @returns Date from string
     */
    getDate(dateString) {
        let date;
        // console.log(`Date string: ${dateString}`);
        try {
            dateString += 'Z';
            date = new Date(Date.parse(dateString));
        } catch (e) {
            return null;
        }
        return date;
    }

    /**
     * 
     * @param {String} rawString
     * @returns {String} with commas removed
     */
    removeCommas(rawString) {
        let result = rawString.replace(',', '');
        return result;
    }

    /**
     * 
     * @param {String} rawString 
     * @returns 
     */
    removeNonAlphanumeric(rawString) {
        return rawString.replace(/[^a-zA-Z0-9]/g, '');
    };

    /**
     * Returns true if any underlines are detected
     * in the TD's of a row handle.
     * @param {ElementHandle} rowHandle 
     * @param {Page} page 
     * @returns {Promise<Boolean>}
     */
    async rowHasUnderlines(rowHandle, page) {
        // Border seems to be on the TD's;
        // border-bottom:1pt solid
        let tdHandles = await rowHandle.$$('td');
        for await (const td of tdHandles) {
            let styleString = await td.getProperty('href');
            if (styleString.contains('border-bottom:1pt solid')) {
                return true;
            }
        }
        return false;
    }
}