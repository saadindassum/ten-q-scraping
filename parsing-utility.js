export class ParsingUtility {
    constructor () {}

    /**
     * 
     * @param {String} rawDateString
     * @returns Date from string
     */
    getDate(dateString) {
        let date;
        // console.log(`Date string: ${dateString}`);
        try {
            dateString += 'Z';
            date = new Date(Date.parse(dateString));
        } catch (e) {
            return Date(Date.now());
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
}