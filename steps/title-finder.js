import { ParsingUtility } from "../parsing-utility.js";
import { AsciiUtility } from "../ascii-parsing-utility.js";
import { ElementHandle, Page } from "puppeteer";

var parsingUtility = new ParsingUtility();

/**
 * Fetches titles and dates for scheudules
 */
export class TitleFinder {
    constructor() {
        this.scheduleTitle = '';
        this.date = null;
        this.dataIndex = -1; // Intended so that we can continue from this row if the title was in the table
    }

    /**
     * 
     * @param {String} ttl 
     * @returns {Boolean} whether the title belongs to a schedule
     */
    titleValid(ttl) {
        if (ttl.length == 0) return false;
        let lc = ttl.toLowerCase();
        let includesWord = lc.includes('schedule of investments') || lc.includes('schedule of portfolio investments');
        let shortEnough = lc.length < 550;
        return includesWord && shortEnough
    }

    /**
     * Parses for a string and sets this.date to that string if it is found.
     * @param {String} line
     */
    checkForDate(line) {
        let date = parsingUtility.getDate(line);
        if (date.toString() === 'Invalid Date') {
            return;
        }
        this.date = date;
    }

    /**
     * For older documents stored in txt form.
     * Sets date if a date is found.
     * @param {String[]} pages a 
     * @returns {String} the title of the schedule.
     */
    barebones(sheet) {
        // We're gonna get rid of the table.
        let split = sheet.split('<TABLE>');
        if (split.length < 2) {
            return '';
        }
        let title = split[0];
        // But we're not done yet, because these titles have a bunch of indent space at the start.
        // First we separate by line breaks
        let lines = title;
        lines = lines.split(/\r?\n|\r/);
        for (let i = 0; i < lines.length; i++) {
            let noSpace = lines[i];
            noSpace = parsingUtility.removeSpaces(noSpace);
            if (noSpace.length > 0) {
                // There's data. We clean it and add it.
                lines[i] = parsingUtility.removeExtraSpaces(lines[i]);
                if (this.scheduleTitle.length == 0) {
                    this.scheduleTitle += lines[i];
                } else {
                    this.scheduleTitle += `\n${lines[i]}`;
                }
                this.checkForDate(lines[i]);
            }
        }
        title = parsingUtility.removeLineBreaks(title);
        return parsingUtility.removeExtraSpaces(title);
    }

    /**
     * 
     * @param {ElementHandle} handle 
     * @param {Page} page 
     * @param {String} tagName 
     * @returns {Promise<String>} title
     */
    async findInHandle(handle, page, tagName) {
        // console.log(tagName);
        if (tagName === 'TABLE') {
            return await this.findInTable(handle, page);
        } else if (tagName === 'DIV') {
            return await this.findInDiv(handle, page);
        } else {
            throw new Error('Unknown case. Could not find title');
        }
    }

    /**
     * 
     * @param {ElementHandle} tableHandle 
     * @param {Page} page 
     * @returns {Promise<String>}
     */
    async findInTable(tableHandle, page) {
        const rows = await tableHandle.$$('tr');

        let rowHandles = new Array();
        for await (const rowHandle of rows) {
            rowHandles.push(rowHandle);
        }
        let title = '';
        let i = 0;
        for (i; i < rowHandles.length; i++) {
            const tds = await rowHandles[i].$$('td');
            if (tds.length > 1) {
                // We want to know how many cells have data in them.
                let count = await parsingUtility.countContent(tds, page);
                if (title.length != 0) {
                    // This could mean either we are at categories.
                    // But there are also title rows with more than 1 td.
                    if (count > 1) {
                        break;
                    }
                }
                if (i != 0) {
                    if (count > 1) {
                        break;
                    }
                }
            }
            let str = await parsingUtility.rowAsString(tds, page);
            if (str.length > 0) {
                title += str;
                title += '\n';
                this.checkForDate(str);
            }
        }
        this.dataIndex = i;
        title = parsingUtility.replaceCommas(title, ';');
        return title;
    }

    /**
     * 
     * @param {ElementHandle} divHandle 
     * @param {Page} page 
     * @returns {Promise<String>}
     */
    async findInDiv(divHandle, page) {
        const pHandles = await divHandle.$$('div > p');
        let title = '';

        for (const pHandle of pHandles) {
            const str = await parsingUtility.parseP(pHandle, page);
            let noSpace = '';
            if (str) {
                noSpace = parsingUtility.removeNonAlphanumeric(str);
            }
            if (noSpace.length > 0 && !str.includes('Table of Contents')) {
                title += str;
                title += '\n';
                //Because the date always comes last.
                this.checkForDate(str);
            }
        }
        title = parsingUtility.replaceCommas(title, ';');
        return title;
    }

    /**
     * 
     * @param {ElementHandle} divHandle 
     * @param {Page} page 
     * @returns {Promise<String>}
     */
    async findInDivArray(divHandles, page) {
        let title = '';
        console.log('finding in div array');
        for (const divHandle of divHandles) {
            let str = await page.evaluate(
                el => el.textContent,
                divHandle
            );
            console.log(`Parsed: '${str}'`);
            let noSpace = '';
            if (str) {
                noSpace = parsingUtility.removeNonAlphanumeric(str);
            }
            if (noSpace.length > 0 && !str.includes('Table of Contents')) {
                title += str;
                title += '\n';
                //Because the date always comes last.
                this.checkForDate(str);
            }
        }
        title = parsingUtility.replaceCommas(title, ';');
        return title;
    }
}