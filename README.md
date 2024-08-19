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
