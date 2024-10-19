import { ScheduleOfInvestments } from './ten-q-objects';

const tableOpen = '<table';
const tableClose = '</table>';
const schedTitle = 'schedule of investments';

/**
 * Takes an HTML file as a string, and finds a list of schedules of investment in it
 * @param {String} htmlString 
 * @returns {String[]}
 */
function parseHTML(htmlString) {
    // The variable we'll be returning.
    let schedules = new Array();
    // HP is so that we can tell nests. Hopefully we'll find none
    // but here's the safety.
    let titleFound = false;

    //Tells 500 minus the number of characters since we last saw the table
    let titleHP = 0;

    // Tells us whether we're in a table
    let inTable = false;

    // In case tables are nested, tells us what level of the nest we're on.
    let tableHP = 0;

    // For recording tables as strings
    let tableString = '';

    // We always store tables. If we find a matching title,
    // we parse the table once we get to the closing tag.

    for (let i = 0; i < htmlString.length; i++) {
        // T A G   D E T E C T I O N
        if (htmlString.substring(i, i + tableOpen.length) === tableOpen) {
            // We found a table open tag.
            if (inTable = false) {
                // This means we have an old table string stored.
                // So we clear it.
                tableString = '';
            }
            inTable = true;
            tableHP++;
        }
        else if (htmlString.substring(i, i + tableClose.length) === tableClose) {
            tableHP--;
            if (tableHP == 0) {
                inTable = false;
                tableString += tableClose;
                // This is where we process the table if the title is valid
                if (titleFound) {
                    let sched = parseTable(tableString);
                    schedules.push(sched);
                    titleFound = false;
                }

            }
        }
        // T I T L E   D E T E C T I O N
        else if (htmlString.substring(i, i + schedTitle).toLowerCase() === schedTitle) {
            titleFound = true;
            titleHP = 500;
        }

        // Title HP handling
        else if (titleHP > 0) {
            titleHP--;
            if (titleHP == 0) {
                // It's been more than 500 characters since we saw schedule
                // So we were not looking at a title.
                titleFound = false;
            }
        }
    }
    return schedules;
}

/**
 * Takes a table as a string going from '<table>' to '</table>'
 * Assumes it's a schedule and returns the strings of all rows containing PIK's.
 * @param {String} tableString 
 * @returns {String}
 */
function parseTable(tableString) {
    // TODO: implement
    // 1. Skip irrelevant data. Find categories along with lengths (colspans)
    // 2. Knowing lengths, parse information from tables.
    let bodyString = getTableBody(tableString);
    let rows = getRows(bodyString);
    let out = '';
    for (let row of rows) {
        if (rowHasPIK(row)) {
            out += row;
            out += '\n';
        }
    }
}

/**
 * Retrieves the tablebody as a string, no tags included.
 * @param {String} tableString 
 * @return {String}
 */
function getTableBody(tableString) {
    const bodyTag = '<tbody>';
    const closeBody = '</tbody>';
    let record = false;
    let str = '';
    for (let i = 0; i < tableString.length; i++) {
        if (tableString.substring(i, i + bodyTag.length) === bodyTag) {
            record = true;
        } else if (tableString.substring(i, i + closeBody.length) === closeBody) {
            break;
        }

        if (record) {
            str += tableString.charAt(i);
        }
    }
    str = str.split(bodyTag).join('');
    return str;
}

/**
 * Returns every row in the table body as a string. Tag included
 * @param {String} bodyString 
 * @returns {String[]}
 */
function getRows(bodyString) {
    const tag = '<tr';
    const closeTag = '</tr>';

    let arr = new Array();
    let currentStr = '';
    let record = false;
    for (let i = 0; i < bodyString.length; i++) {
        if (bodyString.substring(i, i + tag.length) === tag) {
            // tr opens
            record = true;
        } else if (bodyString.substring(i, i + closeTag.length) === closeTag) {
            currentStr += closeTag;
            record = false;
            arr.push(currentStr);
            currentStr = '';
        }
        if (record) {
            currentStr += bodyString.charAt(i);
        }
    }
    return arr;
}

/**
 * 
 * @param {String} tagString 
 * @returns {Number} colspan value
 */
function getColspan(tagString) {
    const cStr = 'colspan:';
    let record = false;
    let colspanString = '';
    for (let i = 0; i < tagString.length; i++) {
        if (tagString.substring(i, i + cStr.length)) {
            record = true;
        }
        if (record) {
            if (tagString.charAt(i) === ';') {
                break;
            }
            colspanString += tagString.charAt(i);
        }
    }
    if (colspanString.length == 0) {
        return 1;
    }
    colspanString = colspanString.split(cStr).join('');
    return Number(colspanString);
}

/**
 * 
 * @param {String} rowString 
 * @returns {Boolean}
 */
function rowHasPIK(rowString) {
    const pik = 'PIK';
    for (let i = 0; i < rowString.length; i++) {
        if (rowString.substring(i, i + pik.length) == pik) {
            console.log('%cPIK FOUND!', 'color:green');
            return true;
        }
    }
    return false;
}