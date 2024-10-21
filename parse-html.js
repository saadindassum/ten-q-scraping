import { ParsingUtility } from "./parsing-utility.js";
const tableOpen = '<table';
const tableClose = '</table>';
const schedTitle = 'schedule of investments';

const parsingUtility = new ParsingUtility();

/**
 * Takes an HTML file as a string, and finds a list of schedules of investment in it
 * @param {String} htmlString 
 * @returns {String[][]}
 */
export function parseHTML(htmlString) {
    console.log('PARSING HTML FOR PIK ROWS');
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
            console.log(`%cTable found!`, 'color:yellow');
            // We found a table open tag.
            if (inTable == false) {
                // This means we have an old table string stored.
                // So we clear it.
                tableString = '';
            }
            inTable = true;
            tableHP++;
            console.log(`inTable: ${inTable}`);
        }
        else if (htmlString.substring(i, i + tableClose.length) === tableClose) {
            console.log(`%cTable close found!`, 'color:pink');
            tableHP--;
            if (tableHP == 0) {
                inTable = false;
                tableString += tableClose;
                // This is where we process the table if the title is valid
                if (titleFound) {
                    let sched = parseTable(tableString); // String array
                    schedules.push(sched);
                    titleFound = false;
                    titleHP = 0;
                } else {
                    // console.error('Title found was set to false.');
                }
            } else {
                tableHP--;
            }
        }
        // T I T L E   D E T E C T I O N
        else if (htmlString.substring(i, i + schedTitle.length).toLowerCase() === schedTitle) {
            console.log(`%cSched title found!`, 'color:orange');
            titleFound = true;
            titleHP = 1000;
        }

        // Title HP handling
        else if (titleHP > 0 && !inTable) {
            titleHP--;
            if (titleHP == 0) {
                // It's been more than 500 characters since we saw schedule
                // So we were not looking at a title.
                console.log('title out of HP');
                titleFound = false;
            }
        }

        else if (inTable) {
            tableString += htmlString[i];
        }
    }
    return schedules;
}

/**
 * Takes a table as a string going from '<table>' to '</table>'
 * Assumes it's a schedule and returns the strings of all rows containing PIK's.
 * @param {String} tableString 
 * @returns {String[]}
 */
function parseTable(tableString) {
    console.log('%cParsing table', 'color:orange');
    // TODO: implement
    // 1. Skip irrelevant data. Find categories along with lengths (colspans)
    // 2. Knowing lengths, parse information from tables.
    let bodyString = getTableBody(tableString);
    let rows = getRows(bodyString);
    let out = new Array();
    for (let row of rows) {
        if (rowHasPIK(row)) {
            out.push(tdsAsCSV(row));
        }
    }
    return out;
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

/**
 * Takes a rowstring and extracts text content inside the TD tags
 * as CSV string.
 * @param {String} rowString 
 */
function tdsAsCSV(rowString) {
    const tdOpen = '<td';
    const tdClose = '</td>';

    // Once we've found an opening tag, this will help us find the end of the tag '>'
    let gatorFound = false;

    // Tells us if we're in a TD tag
    let inTag = false;

    // To record our content
    let str = '';

    // And to make our array which we'll later convert to CSV
    let arr = new Array();


    for (let i = 0; i < rowString.length; i++) {
        // Are we in a tag or not?
        if (inTag) {
            if (gatorFound) {
                // Find out if we need to close
                // Else record the current character
                if (rowString.substring(i, i + tdClose.length) === tdClose) {
                    // We need to close
                    str = stripTags(str);
                    if (str.length > 0) {
                        arr.push(str);
                    }
                    str = '';
                    gatorFound = false;
                    inTag = false;
                    i += tdClose.length - 1;
                } else {
                    str += rowString[i];
                }
            } else {
                // We need to find the gator.
                if (rowString[i] === '>') {
                    gatorFound = true;
                }
            }
        } else {
            // If we're here, we're looking for a tag.
            if (rowString.substring(i, i + tdOpen.length) === tdOpen) {
                gatorFound = false;
                inTag = true;
            }
        }
    }
    // Now we should have all our row content in a string array
    // Let's add them back together separated with commas
    let output = arr.join(',');
    return output;
}

/**
 * It does what it says
 * @param {String} htmlString 
 */
function stripTags(htmlString) {
    let record = true;
    let output = '';
    for (let i = 0; i < htmlString.length; i++) {
        if (htmlString[i] === '<') {
            record = false;
        } else if (htmlString[i] === '>') {
            record = true;
        } else {
            if (record) {
                output += htmlString[i];
            }
        }
    }
    output = parsingUtility.removeExtraSpaces(output);
    output = output.split('&nbsp;').join('');
    // console.log(`output: '${output}'`);
    return output;
}