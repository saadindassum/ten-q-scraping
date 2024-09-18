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
        let result = rawString.split(',').join('');
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
        //Remove non-ascii characters
        str = str.split(/[^\x00-\x7F]/g).join('');
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
            if (this.stringHasUnderline(styleString)) {
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
        if (this.stringHasUnderline(styleString)) {
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
        let pHandle = await tdHandle.$('p');
        let spanHandle = await tdHandle.$('span');
        let fontHandle = await tdHandle.$('font');
        let bHandle = await tdHandle.$('b');
        let divHandle = await tdHandle.$('div > span');
        if (pHandle == null && spanHandle == null && fontHandle == null && bHandle == null && divHandle == null && ixHandle == null) {
            str = await page.evaluate(
                handle => handle.textContent,
                tdHandle
            );
        } else if (pHandle != null) {
            return await this.parseP(pHandle, page);
        } else if (spanHandle != null) {
            // Span is not null
            str = await page.evaluate(
                handle => handle.textContent,
                spanHandle
            );
        } else if (fontHandle != null) {
            str = await page.evaluate(
                handle => handle.textContent,
                fontHandle
            );
        } else if (divHandle != null) {
            str = await page.evaluate(
                handle => handle.textContent,
                divHandle
            );
        } else {
            // B is not null
            str = await page.evaluate(
                handle => handle.textContent,
                bHandle
            );
        }
        if (str === '$' || str === '—') {
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

    /**
     * Parses a handle for a P tag and its microvariations
     * @param {ElementHandle} pHandle 
     * @param {Page} page
     * @returns {Promise<String>} text content.
     */
    async parseP(pHandle, page) {
        let str = '';
        let bFontHandle = await pHandle.$('b > font');
        let fontHandle = await pHandle.$('font');
        if (bFontHandle == null && fontHandle == null) {
            str = await page.evaluate(
                (handle) => handle.textContent,
                pHandle,
            );
        } else if (bFontHandle != null) {
            str = await page.evaluate(
                (handle) => handle.textContent,
                bFontHandle,
            );
        } else {
            str = await page.evaluate(
                (handle) => handle.textContent,
                fontHandle,
            );
        }
        str = this.removeExtraSpaces(str);
        return str;
    }

    /**
     * Parses the TD elements in the row, and returns true if none of them have text.
     * @param {ElementHandle} rowHandle
     * @param {Page} page
     * @returns {Promise<Boolean>} Whether the row is empty or not
     */
    async rowBlank(rowHandle, page) {
        const tds = await rowHandle.$$('td');
        for await (const tdHandle of tds) {
            const str = await this.parseTd(tdHandle, page);
            if (str.length != 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * 
     * @param {ElementHandle} rowHandle 
     * @param {Page} page 
     * @returns {Promise<String>}
     */
    async rowAsString(tdHandles, page) {
        let str = '';
        for await (let td of tdHandles) {
            str += await this.parseTd(td, page);
        }
        return str;
    }

    /**
     * 
     * @param {ElementHandle[]} tdHandles 
     * @param {Page} page 
     */
    async countContent(tdHandles, page) {
        let count = 0;
        for await (let td of tdHandles) {
            let str = await this.parseTd(td, page);
            str = this.removeNonAlphanumeric(str);
            if (str.length > 0) {
                count++;
            }
        }
        return count;
    }

    /**
     * Checks if a row has numbers only
     * @param {ElementHandle[]} tdHandles 
     * @param {Page} page 
     */
    async numbersOnly(tdHandles, page) {
        // console.log('Checking numbers only!');
        for (let td of tdHandles) {
            let str = await this.parseTd(td, page);
            str = this.removeCommas(str);
            let toNumber = Number(str);
            if (toNumber.toString() === 'NaN') {
                console.error(`%c FOUND NaN! Str: ${str}`, 'color:orange');
                return false;
            }
        }
        return true;
    }

    /**
     * 
     * @param {ElementHandle[]} tdHandles 
     * @param {Page} page 
     * @returns 
     */
    async detectSubtotalRow(tdHandles, page) {
        for await (let td of tdHandles) {
            let str = await this.parseTd(td, page);
            str = str.toLowerCase();
            if (str.includes('subtotal:') || str.includes('total:')) {
                return true;
            }
        }
        return false;
    }
}