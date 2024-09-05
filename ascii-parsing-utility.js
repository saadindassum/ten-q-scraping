export class AsciiUtility {
    constructor() { }

    /**
     * 
     * @param {String} rawString 
     * @returns {String[]} the string split by people
     */
    splitPages(rawString) {
        return rawString.split('<PAGE>');
    }
    
}