import { ElementHandle, Page } from 'puppeteer';
import { CategoryInfo, ScheduleOfInvestments, ScheduleInfo } from './ten-q-objects.js';
import { InfoToSchedule } from './steps/info-to-schedule.js'
import { ScheduleFinder } from './steps/schedule-finder.js';
import { TitleFinder } from './steps/title-finder.js';
import { CategoryFinder } from './steps/category-finder.js';
import { CellScanner } from './steps/cell-scanner.js';

const titleFinder = new TitleFinder();
const categoryFinder = new CategoryFinder();
const cellScanner = new CellScanner();
const scheduleFinder = new ScheduleFinder();
const infoToSchedule = new InfoToSchedule();

/**
 * A class which will handle choosing which variation to try parsing with.
 * All that should be done in this class is try a variation, and then try
 * other variations if results came up null.
 */
export default class TenQUtility {
    constructor() { }

    /**
     * 
     * @param {Page} page the page to use
     * @param {string} link a link to the filing page
     * @returns {Promise<ScheduleOfInvestments[]>} a list of a schedule of investments.
     */
    async parse10Q(page, link) {
        // console.log(`Parsing link ${link}`);
        await page.goto(link, { waitUntil: 'networkidle0' });

        // First off, we want to know if it's the ultimate edge case - barebones.
        let preHandle = await page.$('body > pre');
        if (preHandle != null) {
            return await this.parseBarebones(page, preHandle);
        }
        
        return await this.parseOrganized(page);
    }

    /**
     * Handled separately because we don't deal with handles
     * after the pre tag.
     * @param {Page} page 
     * @param {ElementHandle} preHandle 
     * @returns {Promise<ScheduleOfInvestments[]>} a list of a schedule of investments.
     */
    async parseBarebones(page, preHandle) {
        let docContent = await page.evaluate(
            (handle) => handle.textContent,
            preHandle,
        );
        // Now we have a string with all the doc content.
        // We split it into a String[] with all pages
        // And we call it 'sheets' to avoid confusion
        let sheets = docContent.split('<PAGE>');

        // We check every page for a schedule
        let scheduleList = new Array();
        for (let i = 0; i < sheets.length; i++) {
            // If a schedule is found, we proceed.
            let title = titleFinder.barebones(sheets[i]);
            // We check if the title has what we want.
            // If it doesn't, onto the next iteration.
            if (!titleFinder.titleValid(title)) {
                continue;
            }
            // console.log(`%c ${title}`, 'color: green;');
            let date = titleFinder.date;
            let categoryInfo = categoryFinder.barebones(sheets[i]);
            let data = cellScanner.barebones(sheets[i], categoryInfo);
            let sched = new ScheduleOfInvestments(title, date, categoryInfo.getCategories(), data);
            scheduleList.push(sched);
        }
        return scheduleList;
    }

    /**
     * For organized documents
     * @param {Page} page 
     * @returns {Promise<ScheduleOfInvestments[]>} a list of a schedule of investments.
     */
    async parseOrganized(page) {
        // First we need info on all our schedules
        let infos = await scheduleFinder.findSchedules(page);
        for (const scheduleInfo of infos) {
            await infoToSchedule.convert(scheduleInfo, page);
        }
        return null;
    }
}