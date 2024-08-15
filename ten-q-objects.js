/**
 * Information about categories for an organized 10Q table.
 * @param {Number[]} indices
 * @param {String[]} indices
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
     * @returns {String[]} An array of categories.
     */
    getCategories() {
        return this.map.get('categories');
    }
}