import { ElementHandle, Page } from 'puppeteer';
import { ScheduleInfo, ScheduleOfInvestments } from '../ten-q-objects.js';
import { TitleFinder } from './title-finder.js';

let titleFinder = new TitleFinder();

export class ScheduleFinder {
    constructor() {}

    /**
     * @param {Page} page
     * @returns {Promise<ScheduleInfo[]>}
     */
    async findSchedules(page) {

        // We have to find the containers for the title, going from broadest to least broad
        // We basically just go through every container case we know.
        let containers = await page.$$('body > document > type > sequence > filename > description > text > div > table');
        if (containers == null || containers.length == 0) {
            containers = await page.$$('body > div > table');
        }
        if (containers == null || containers.length == 0) {
            throw new Error('Failed to find schedule containers');
        }
        console.log(`Containers length: ${containers.length}`);
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
            console.log(`%c TITLE VALID`, 'color:green');
            if (tagName === 'TABLE') {
                // Case 1
                let currentInfo = new ScheduleInfo(container, title, tagName, titleFinder.date, titleFinder.dataIndex);
                infos.push(currentInfo);
            }
        }
        return infos;
    }
}