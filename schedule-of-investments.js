export class InvestmentSummary {
    constructor(companyName, companyLocation, industry, investment, principal, costOfInvestment, fairValue) {
        this.companyName = companyName;
        this.companyLocation = companyLocation;
        this.industry = industry;
        this.investment = investment;
        this.principal = principal;
        this.costOfInvestment = costOfInvestment;
        this.fairValue = fairValue;
    }

    /**
     * 
     * @param {Map<String, any>} json 
     * @returns InvestmentSummary object.
     */
    fromJson(json) {
        return new InvestmentSummary(
            json['companyName'],
            json['companyLocation'],
            json['industry'],
            json['investment'],
            json['principal'],
            json['costOfInvestment'],
            json['fairValue']
        );
    }

    /**
     * Exports investment summary as json
     */
    toJson() {
        const json = {
            'companyName': this.companyName,
            'companyLocation': this.companyLocation,
            'industry': this.industry,
            'investment': this.investment,
            'principal': this.principal,
            'costOfInvestment': this.costOfInvestment,
            'fairValue': this.fairValue
        }
        return json;
    }
}

console.log('Class imported!');