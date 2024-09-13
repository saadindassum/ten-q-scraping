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
     * @returns {String}
     */
    removeNonAlphanumeric(rawString) {
        return rawString.replace(/[^a-zA-Z0-9]/g, '');
    };

    removeExtraSpaces(rawString) {
        let split = rawString.split(/\s/g);
        return this.arrayToString(split);
    }

    /**
     * 
     * @param {String[]} arr 
     * @returns {String} with only spaces between data.
     */
    arrayToString(arr) {
        let output = '';
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].length > 0) {
                output += `${arr[i]} `;
            }
        }
        // Output ends up with one extra ' ', which we remove.
        output = output.slice(0, output.length - 1);
        return output;
    }

    /**
     * 
     * @param {String} rawString 
     * @returns {String[]}
     */
    splitBySpaces(rawString) {
        return rawString.split(/\s/g);
    }

    /**
    * Removes all spaces in a string
    * @param {String} rawString 
    * @returns {String}
    */
    removeSpaces(rawString) {
        return rawString.split(/\s/g).join('');
    }
    
    /**
     * 
     * @param {String} rawString 
     * @returns {String}
     */
    removeLineBreaks(rawString) {
        return rawString.split(/\r?\n|\r/).join('');
    }

    removeCommas(rawString) {
        return rawString.replace(/,/g, '');
    }

    replaceCommas(rawString, replacement) {
        return rawString.replace(/,/g, replacement);
    }

    replaceLinebreaks(rawString, replacement) {
        return rawString.split(/\r?\n|\r/).join(replacement);
    }

    removeDollar(rawString) {
        return rawString.replace(/$/g, '');
    }

    /**
     * 
     * @param {String} rawString 
     * @returns {String} prepares string for CSV output
     */
    prepareStringForOutput(rawString) {
        let str = this.removeCommas(rawString);
        str = str.replace(/$/g, '');
        str = this.removeLineBreaks(str);
        return str;
    }

    /**
     * Returns true if any underlines are detected
     * in the TD's of a row handle.
     * @param {ElementHandle} rowHandle 
     * @param {Page} page 
     * @returns {Promise<Boolean>}
     */
    async rowHasUnderlines(rowHandle, page) {
        let tdHandles = await rowHandle.$$('td');
        for await (const td of tdHandles) {
            let styleString = '';
            try {
                styleString = await page.evaluate(
                    element => element.getAttribute('style'),
                    td
                );
            } catch (e) { }
            // console.log(styleString);
            if (this.stringHasUnderline(styleString))
            {
                return true;
            }
        }
        return false;
    }

    /**
     * 
     * @param {ElementHandle} td 
     * @param {Page} page 
     * @returns {Boolean}
     */
    async tdHasUnderlines(td, page) {
        let styleString = '';
        try {
            styleString = await page.evaluate(
                element => element.getAttribute('style'),
                td
            );
        } catch (e) {
            return false;
        }
        console.log(styleString);
        if (this.stringHasUnderline(styleString))
        {
            return true;
        }
        return false;
    }

    /**
     * Takes any style string and tells you if it has an underline
     * @param {String} styleString 
     * @returns {Boolean}
     */
    stringHasUnderline(styleString) {
        // Border seems to be on the TD's;
        // border-bottom:1pt solid
        // border-bottom:solid windowtext 1.0pt
        // We split the array using ';'
        let split = styleString.split(';');

        // Now we seek the border bottom substring
        let bbString = '';
        for (let i = 0; i < split.length; i++) {
            if (split[i].includes('border-bottom')) {
                bbString = split[i];
            }
        }
        if (bbString.length == 0) return;

        // now that we have bbString...
        //We get the actual specifications
        split = bbString.split(':');
        //And then we separate those by spaces
        split = split[1].split(' ');

        let isSolid = false;
        let overOne = false;
        for (let i = 0; i < split.length; i++) {
            if (split[i].includes('solid')) {
                isSolid = true;
            }
            //we also try to parse for a number
            try {
                let num = parseFloat(split[i]);
                if (num > 0) {
                    overOne = true;
                }
            } catch (e) { }
        }
        return (isSolid && overOne);
    }

    /**
     * Extracts text for TD handle of all known variations of Td
     * @param {ElementHandle} tdHandle 
     * @param {Page} page 
     * @returns {Promise<String>}
     */
    async parseTd(tdHandle, page) {
        let str = '';
        let spanHandle = await tdHandle.$('span');
        let bHandle = await tdHandle.$('b');
        if (bHandle == null && spanHandle == null) {
            str = await page.evaluate(
                handle => handle.textContent,
                tdHandle
            );
        } else if (spanHandle != null) {
            // Span is not null
            str = await page.evaluate(
                handle => handle.textContent,
                spanHandle
            );
        } else {
            // B is not null
            str = await page.evaluate(
                handle => handle.textContent,
                bHandle
            );
        }
        if (str === '$') {
            // In this case we don't want to strip it of alphanumerics
            // We want to detect it. Let's return it.
            return str;
        }
        let noSpace = str;
        noSpace = this.removeNonAlphanumeric(noSpace);
        // console.log(`NOSPACE:${noSpace}\nlength: ${noSpace.length}`);
        if (noSpace.length == 0) {
            return noSpace;
        }
        return str;
    }
}