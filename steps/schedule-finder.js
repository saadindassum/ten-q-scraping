import { ElementHandle, Page } from 'puppeteer';
import { ScheduleInfo, ScheduleOfInvestments } from '../ten-q-objects.js';
import { TitleFinder } from './title-finder.js';

let titleFinder = new TitleFinder();

export class ScheduleFinder {
    constructor() { }

    /**
     * @param {Page} page
     * @returns {Promise<ScheduleInfo[]>}
     */
    async findSchedules(page) {

        // We have to find the containers for the title, going from broadest to least broad
        // We basically just go through every container case we know. From least to most compatible
        let containers = await this.findTypeTwo(page);
        if (containers == null || containers.length == 0) {
            containers = await this.findTypeOne(page)
        }
        
        if (containers == null || containers.length == 0) {
            throw new Error('Failed to find schedule containers');
        }
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
     * Scans for type one and its microvariations
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
}