# Ten Q Data Scraping
 A little script I cooked up that reads a list of CIK's and extracts their data from 2004 to 2024.
 It uses three cluster workers at a time, so make sure your computer has the ram, or change the number of
 cluster workers in index.js line 22.

 ## Installation
 First make sure you have Node.js and NPM installed.
 Then install puppeteer and cluster.
```
npm install --save puppeteer
npm install --save puppeteer-cluster
```

# Running
Put your desired CIK numbers in the file searches.txt, then run the command
```
node ./index.js
```

## Broad Strokes Update

We've done brute force for a while, and that's led us to a better understanding of these documents.
Each schedule has a title, and a table. For now we're only going to look for the keyword "schedule of investments".
For each step, we keep on adding variations, and cases where we decide what variation to go with.
This approach is much more flexible. For example, if you have a type one TD on a type 2 document, the program
should now parse that just fine, where as it would have been impossible with our previous approach.
Any fixes to parsing will also apply to all sorts of parsing, speeding up the process.

Oh, and did I mention running time will be much faster as well? Here are the steps to parse a 10Q for schedule.

1. Identify a title which belongs to a table and contains the string "schedule of investments".
2. Find the table.
3. If file date was not found in the title, parse the date.
4. If the file date was not found in the title, find the file date on the table.
5. Parse category info (category names along with their column indices)
6. Parse each row of the table.

We'll implement these top to bottom, working on the worst/default case first. Worst case I can think of right now being an unparsed document where everything's contained in a single p tag.