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
        let includesWord = lc.includes ('schedule of investments') || lc.includes('schedule of portfolio investments');
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
        if (tagName === 'TABLE') {
            return await this.findInTable(handle, page);
        } else {
            throw new Error('Unknown case. Could not find title');
        }
    }

    /**
     * 
     * @param {ElementHandle} tableHandle 
     * @param {Page} page 
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
                if (title.length != 0) {
                    //This means we already went into the other
                    //condition and are done reading the title.
                    //So we are done with the row.
                    break;
                }
                if (i != 0) {
                    break;
                }
            }
            else {
                for await (const tdHandle of tds) {
                    const spanHandle = await tdHandle.$('span');
                    let str;
                    str = await parsingUtility.parseTd(tdHandle, page);
                    if (str.length != 0) {
                        this.checkForDate(str);
                        title += str;
                        title += '\n';
                    }
                }
            }
        }
        this.dataIndex = i;
        return title;
    }
}