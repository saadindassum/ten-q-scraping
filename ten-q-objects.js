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
     */
    constructor(indices, categories) {
        this.map = new Map();
        this.map.set('categories', categories);
        this.map.set('indices', indices);
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
}

/**
 * All the info for a schedule of investments
 * AKA table.
 */
export class ScheduleOfInvestments {

    /**
     * 
     * @param {String} title
     * @param {Date} date 
     * @param {CategoryInfo} categoryInfo 
     * @param {Map<String, String>[]} data
     */
    constructor(title, date, categoryInfo, data) {
        this.title = title;
        this.date = date;
        this.categoryInfo = categoryInfo;
        this.data = data;
    }

    /**
     * 
     * @returns {Map}
     */
    toJson() {
        map = new Map();
        map.set('title', title);
        map.set('date', date);
        map.set('categoryInfo', categoryInfo);
        map.set('data', data);
        return map;
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
     * @returns {CategoryInfo}
     */
    getCategoryInfo() {
        return this.categoryInfo;
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
     * @param {*} categories 
     */
    constructor(fileDate, categories) {

    }
}