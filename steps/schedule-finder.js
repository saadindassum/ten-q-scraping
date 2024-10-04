import { ElementHandle, Page } from 'puppeteer';
import { ScheduleInfo, ScheduleOfInvestments } from '../ten-q-objects.js';
import { TitleFinder } from './title-finder.js';
import { ParsingUtility } from '../parsing-utility.js';

let titleFinder = new TitleFinder();
let parsingUtility = new ParsingUtility();
export class ScheduleFinder {
    constructor() { }

    /**
     * @param {Page} page
     * @returns {Promise<ScheduleInfo[]>}
     */
    async findSchedules(page) {
        let schedules = await this.findTypeThree(page);
        // We have to find the containers for the title, going from broadest to least broad
        // We basically just go through every container case we know. From least to most compatible
        if (schedules.length > 0) {
            return schedules;
        }
        let containers = await this.findTypeTwo(page);
        if (containers == null || containers.length == 0) {
            containers = await this.findTypeOne(page);
        } else {
            // console.log('Found type 2');
        }
        
        if (containers == null || containers.length == 0) {
            throw new Error('Failed to find schedule containers');
        }
        // console.log('Found type 1');
        // console.log(`Containers length: ${containers.length}`);
        // Here we store all the schedule infos we find.
        let infos = new Array();
        for await (const container of containers) {
            let tagName = await page.evaluate(
                el => el.tagName,
                container
            );
            let title = await titleFinder.findInHandle(container, page, tagName);
            if (!titleFinder.titleValid(title)) {
                // console.error(`TITLE NOT VALID: ${title}`);
                continue;
            }
            // console.log(`%c TITLE VALID:\n${title}`, 'color:green');
            // console.log(`Date: `, titleFinder.date.toString());
            if (tagName === 'TABLE') {
                // Type Two
                let currentInfo = new ScheduleInfo(container, title, tagName, titleFinder.date, titleFinder.dataIndex);
                infos.push(currentInfo);
            } else if (tagName === 'DIV') {
                // Type Two
                let currentInfo = new ScheduleInfo(container, title, tagName, titleFinder.date);
                infos.push(currentInfo);
            } else {
                throw new Error('Unimplemented case when finding schedules');
            }
        }
        return infos;
    }

    /**
     * Scans for type one - a container for the title and the schedule
     * @param {Page} page 
     * @returns {Promise<ElementHandle[]>}
     */
    async findTypeOne(page) {
        let containers = await page.$$('body > document > type > sequence > filename > description > text > div > table');
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > document > type > sequence > filename > description > text > div > div > table');
        }
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > div > table');
        }
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > div > table');
        }
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > div > table');
        }
        return containers;
    }

    /**
     * Scans for type two and its microvariations
     * @param {Page} page 
     * @returns {Promise<ElementHandle[]> | Promise<null>}
     */
    async findTypeTwo(page) {
        let pTestPassed = false;
        let tableTestPassed = false;
        // The container alone can be confused for a type 1.
        // To make sure this is a valid type 2, we must ensure there is a nested table and p's in here.
        // We want at least 3 lines of p tags, and one correctly nested table.
        let containers = await page.$$('body > document > type > sequence > filename > description > text > div');
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > div');
        } if (containers == null) {
            containers == await page.$$('body > document > type > sequence > filename > description > text > div');
        }
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > document > type > sequence > filename > text > div');
        }
        // We iterate through the containers to see if we can find one that has our p requirements
        for await (let container of containers) {
            let pHandles = await container.$$('p');
            if (pHandles.length >= 3) {
                pTestPassed = true;
                break;
            }
        }
        for await (let container of containers) {
            let tableHandles = await container.$$('div > table');
            if (tableHandles.length > 0) {
                tableTestPassed = true;
                break;
            }
        }
        if (!pTestPassed || !tableTestPassed) {
            return null;
        }
        return containers;
    }

    /**
     * For documents where a single container holds all titles and tables.
     * Practically no containers
     * @param {Page} page
     * @returns {Promise<ScheduleInfo[]>}
     */
    async findTypeThree(page) {
        // console.log('Parsing for Type 3');
        let allHandles = await page.$$('body > document > type > sequence > filename > description > text > div > *');
        if (allHandles.length == 0) {
            allHandles = await page.$$('body > document > type > sequence > filename > description > text > *');
        }
        if (allHandles.length == 0) {
            console.error('returning blank');
            return [];
        }
        // console.log(allHandles);
        let scheduleInfos = new Array();
        // Now we basically just have to go through every tag, check the name, and process according to the tags we find.
        // The pattern we're looking for is HR, title (spread accross multiple P's), table.
        // If we hit a table, we use that as our container. If we hit an HR, we can clear our title.
        let title = '';
        let date;
        // console.log('%cstarting loop', 'color:yellow');
        for (let handle of allHandles) {
            //First we determine what tag it is...
            let tagName = await page.evaluate(
                el => el.tagName,
                handle
            );
            let id = await page.evaluate(
                el => el.getAttribute('id'),
                handle,
            )
            if (tagName === 'HR' || id === 'DSPFPageBreakArea') {
                // We clear the title
                title = '';
            } else if (tagName === 'P') {
                let str = await page.evaluate(
                    el => el.textContent,
                    handle
                );
                title += str;
                title += '\n';
                // We also want to parse the string for a date
                let potentialDate;
                if (str.includes('as of')) {
                    let split = str.split('as of');
                    let potentialStr = parsingUtility.removeExtraSpaces((split)[1]);
                    potentialDate = new Date(Date.parse(potentialStr));
                } else {
                    potentialDate = new Date(Date.parse(str));
                }
                if (potentialDate.toString() !== 'Invalid Date' && potentialDate.toString() !== 'NaN') {
                    date = potentialDate;
                }
            } else if (tagName === 'TABLE') {
                if (titleFinder.titleValid(title)) {
                    //This means we've successfully found a schedule.
                    // console.log(`%cFOUND SCHEDULE!\n${title}`, 'color:green');
                    if (date == null || date.toString() === 'NaN') {
                        throw new Error('Date null in Type 3 schedule!');
                    }
                    // console.log(`%cDate: ${date.toString()}`, 'color:yellow');
                    let info = new ScheduleInfo(handle, title, tagName, date, 0);
                    scheduleInfos.push(info);
                }
            } else if (tagName === 'DIV') {
                // By far the worst one, because this can contain anything in a few variations.
                // First let's check if it's a title.
                // So far, I've seen the element contain other divs, each which contains one div per each line of the title.
                // There is also a variation in which the other divs aren't wrapped in a single div. They have to be treated kind of like p tags.
                // We'll handle that after we handle a lack of inner divs.
                // console.log(`parsing div`);
                let divs = await handle.$$('div');
                // console.log(`Divs length: ${divs.length}`);
                if (divs.length > 0) {
                    // We've found subdivs. AKA a title.
                    title = await titleFinder.findInDivArray(divs, page);
                    date = titleFinder.date;
                } else {
                    let tableHandles = await handle.$$('table');
                    // console.log(`%cTABLE HANDLES LENGTH: ${tableHandles.length}`, 'color:pink');
                    if (tableHandles.length > 0) {
                        let tableHandle = tableHandles[0];
                        if (titleFinder.titleValid(title)) {
                            //This means we've successfully found a schedule.
                            // console.log(`%cFOUND SCHEDULE!\n${title}`, 'color:green');
                            if (date == null || date.toString() === 'NaN') {
                                throw new Error('Date null in Type 3 schedule!');
                            }
                            // console.log(`%cDate: ${date.toString()}`, 'color:yellow');
                            let info = new ScheduleInfo(tableHandle, title, 'TABLE', date, 0);
                            scheduleInfos.push(info);
                        }
                    } else {
                        // console.log(`%cLINE BY LINE CASE`, 'color:green');
                        // This means we might have a line-by-line div title.
                        let str = await parsingUtility.parseTd(handle, page);
                        title += str;
                        title += '\n';
                        // We also want to parse the string for a date
                        let potentialDate = new Date(Date.parse(str));
                        if (potentialDate.toString() !== 'Invalid Date' && potentialDate.toString() !== 'NaN') {
                            date = potentialDate;
                        }
                    }
                }
            } 
        }
        return scheduleInfos;
    }
}