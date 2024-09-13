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
        let containers = await page.$$('body > div > table');
        if (containers == null) {
            console.error('Failed to find schedule containers');
            throw new Error('Failed to find schedule containers');
        }

        // Here we store all the schedule infos we find.
        let infos = new Array();
        for await (const container of containers) {
            let tagName = await page.evaluate(
                el => el.tagName,
                container
            );
            let title = await titleFinder.findInHandle(container, page, tagName);
            if (!titleFinder.titleValid(title)) {
                continue;
            }
            if (tagName === 'TABLE') {
                // Case 1
                let currentInfo = new ScheduleInfo(container, title, tagName, titleFinder.date, titleFinder.dataIndex);
                infos.push(currentInfo);
            }
        }
        return infos;
    }
}