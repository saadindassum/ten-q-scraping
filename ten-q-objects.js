import { ElementHandle } from "puppeteer";

/**
 * All the info for a schedule of investments
 * AKA table.
 */
export class ScheduleOfInvestments {

    /**
     * 
     * @param {String} title
     * @param {Date} date 
     * @param {String[]} categories 
     * @param {Map<String, String>[]} data
     */
    constructor(title, date, categories, data) {
        this.title = title;
        this.date = date;
        this.categories = categories;
        this.data = data;
        this.hasData = this.categories.length > 0;
    }

    /**
     * 
     * @returns {Map}
     */
    toJson() {
        map = new Map();
        map.set('title', this.title);
        map.set('date', this.date);
        map.set('categoryInfo', this.categories);
        map.set('data', this.data);
        return map;
    }

    /**
     * @returns {String} information formatted in CSV
     * First line contains the name and date
     */
    toCsv() {
        let str = '';
        // We have to get the title onto one line
        let splitTitle = this.title.split('\n');
        for (const bit of splitTitle) {
            //We want to check that we're not adding
            //the date
            let maybeDate;
            let datesEqual = false;
            try {
                let dateString = bit + 'Z';
                let maybeDate = new Date(Date.parse(dateString));
                maybeDate = maybeDate.toUTCString();
                datesEqual = maybeDate === this.date.toUTCString();
            } catch (e) { }
            if (!datesEqual) {
                if (str && bit != splitTitle[splitTitle.length - 1]) {
                    // If string not empty
                    str += ' - ';
                }
                if (bit) {
                    str += bit;
                } else {
                    str += '';
                }
            }
        }
        str = str.replace(/,/g, ';');
        str += ','

        str += this.date.toISOString();
        str += '\n';

        for (let i = 0; i < this.categories.length; i++) {
            str += this.categories[i];
            str += ','
        }
        str += '\n';

        // Onto the data
        for (let i = 0; i < this.data.length; i++) {
            let row = this.data[i];
            // We want to check for a note first
            let note = row.get('note');
            if (note) {
                str += note;
                str += '\n';
                continue;
            }
            for (let j = 0; j < this.categories.length; j++) {
                str += row.get(this.categories[j]);
                if (str == null || str.length == 0) {
                    str = '';
                }
                str += ',';
            }
            str += '\n';
        }

        // And that's pretty much it.

        return str;
    }

    /**
     * 
     * @returns {String} title
     */
    getTitle() {
        return this.title;
    }

    /**
     * 
     * @returns {Date}
     */
    getDate() {
        return this.date;
    }

    /**
     * 
     * @returns {String[]}
     */
    getCategories() {
        return this.categories;
    }

    /**
     * 
     * @returns {String[][]}
     */
    getData() {
        return this.data;
    }

    /**
     * The table might have a note at the top.
     * If it does, it will be stored at a key
     * 'note' in the 0th row of the map.
     * @returns {String} note, blank if there is no note.
     */
    getNote() {
        try {
            const str = this.map.get('data')[0].get('note');
            return str;
        } catch (e) {
            return '';
        }
    }
}



export class TenQDoc {
    /**
     * 
     * @param {Date} fileDate 
     * @param {ScheduleOfInvestments[]} schedules 
     * @param {String} link
     */
    constructor(fileDate, schedules, link) {
        this.fileDate = fileDate;
        this.schedules = schedules;
        this.link = link;
        this.hasData = this.schedules.length > 0;
    }

    /**
     * @returns {String} of schedules separated by one blank line.
     * Headed by file date
     */
    toCsv() {
        let str = '';
        str += this.link;
        str += '\n';
        str += `FILE DATE - ${this.fileDate}\n\n`;
        for (const schedule of this.schedules) {
            str += schedule.toCsv();
            str += '\n\n';
        }
        if (this.schedules.length < 1) {
            str += 'NO SCHEDULES FOUND';
        }
        return str;
    }
}

export class TenQCollection {
    /**
     * 
     * @param {String} cik
     * @param {TenQDoc[]} formList 
     */
    constructor(cik, formList) {
        this.cik = cik;
        this.formList = formList;
        this.hasData = false;
        for (let form of formList) {
            if (form.hasData) {
                this.hasData = true;
            }
        }
    }

    toCsv() {
        let str = '';
        for (const form of this.formList) {
            
            str += form.toCsv();;
            str += '\n\n\n';
        }
        return str;
    }
}

/**
 * Information about categories for an organized 10Q table.
 * @param {Number[]} indices
 * @param {String[]} categories
 */
export class CategoryInfo {
    map;

    /**
     * Information about categories for an organized 10Q table.
     * @param {Number[]} indices
     * @param {String[]} categories
     * @param {Number} tdLength
     */
    constructor(indices, categories, tdLength) {
        this.map = new Map();
        this.map.set('categories', categories);
        this.map.set('indices', indices);
        this.tdLength = tdLength;
    }

    /**
     * @returns {Number[]} An array of indices which have a category
     */
    getIndices() {
        return this.map.get('indices');
    }

    /**
     * 
     * @param {Number} i
     * @returns {Number} the category index at index i. 
     */
    indexAt(i) {
        return this.map.get('indices')[i];
    }

    /**
     * @returns {String[]} An array of categories.
     */
    getCategories() {
        return this.map.get('categories');
    }

    /**
     * 
     * @param {Number} i 
     * @returns {String} category at index i.
     */
    categoryAt(i) {
        return this.map.get('categories')[i];
    }

    setCategoryAt(i, value) {
        let catArray = this.map.get('categories');
        catArray[i] = value;
        this.map.set('categories', catArray);
    }

    /**
     * 
     * @returns {number} how many TD's were found in the row that stored categories.
     */
    getTdLength() {
        return this.tdLength;
    }
}

/**
 * Information about categories in a barebones 10Q table.
 * @param {Number[]} indices
 * @param {Number[]} lengths
 * @param {String[]} categories
 */
export class AsciiCategoryInfo {
    map;

    /**
     * Information about categories for an organized 10Q table.
     * @param {Number[]} indices
     * @param {String[]} categories
     * @param {Number[]} lengths
     * @param {Number} ulIndex
     */
    constructor(indices, categories, lengths, ulIndex) {
        this.map = new Map();
        this.map.set('categories', categories);
        this.map.set('indices', indices);
        this.map.set('lengths', lengths);
        this.ulIndex = ulIndex;
    }

    getUlIndex() {
        return this.ulIndex;
    }

    /**
     * @returns {Number[]} An array of the index of category columns within a string
     */
    getIndices() {
        return this.map.get('indices');
    }

    /**
     * 
     * @returns {Number[]} the width of the category columns
     */
    getLengths() {
        return this.map.get('lengths');
    }

    /**
     * 
     * @param {Number} i
     * @returns {Number} the category index at index i. 
     */
    indexAt(i) {
        return this.map.get('indices')[i];
    }

    /**
     * @returns {String[]} An array of categories.
     */
    getCategories() {
        return this.map.get('categories');
    }

    /**
     * 
     * @param {Number} i 
     * @returns {String} category at index i.
     */
    categoryAt(i) {
        return this.map.get('categories')[i];
    }

    setCategoryAt(i, value) {
        let catArray = this.map.get('categories');
        catArray[i] = value;
        this.map.set('categories', catArray);
    }

    lengthAt(i) {
        return this.map.get('lengths')[i];
    }

    /**
     * 
     * @returns {number} how many TD's were found in the row that stored categories.
     */
    getTdLength() {
        return this.tdLength;
    }

}

export class ScheduleInfo {
    /**
     * 
     * @param {ElementHandle} containerHandle 
     * @param {String} title 
     * @param {String} tagName 
     * @param {Date} date 
     * @param {Number} dataIndex the first row containing data
     */
    constructor(containerHandle, title, tagName, date, dataIndex) {
        this.containerHandle = containerHandle;
        this.title = title;
        this.tagName = tagName;
        this.date = date;
        this.dataIndex = dataIndex;
    }
}