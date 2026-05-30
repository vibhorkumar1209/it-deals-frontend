// Vendor master list extracted from Frameworks_and_Company_List_14052025.xlsx
// Covers ERP, CRM, HCM, Cloud, Cybersecurity, Analytics, ITSM, Outsourcing, Telecom & more
export const VENDORS = [
  // ERP
  "SAP","SAP S/4HANA","SAP HANA","SAP Business ByDesign","SAP S/4HANA Cloud","SAP Emarsys",
  "Oracle","Oracle Fusion","Oracle NetSuite","Oracle ERP","Oracle Fusion Cloud ERP",
  "Microsoft","Microsoft Dynamics 365","Microsoft Business Central","Dynamics 365",
  "Infor","IFS","Epicor","Sage","Unit4","Plex",
  // CRM / Marketing
  "Salesforce","HubSpot","Creatio","SugarCRM","Zoho","LeadSquared","BUSINESSNEXT","Freshworks","Zendesk",
  "6sense","Demandbase","ZoomInfo","RollWorks","Terminus","Sprinklr","Braze","Klaviyo","Insider",
  // HCM / HR
  "Workday","SAP SuccessFactors","ADP","Ceridian","Dayforce","UKG","Cornerstone","Darwinbox",
  "Darwinbox","Cegid","Yonyou","Bamboo HR","Personio","Rippling",
  // SCM / Procurement
  "Blue Yonder","Kinaxis","o9 Solutions","Manhattan Associates","Coupa","GEP","JAGGAER","Ivalua",
  "e2open","Logility","ToolsGroup","RELEX Solutions","Anaplan","Llamasoft","Basware",
  // Cloud / Infra
  "AWS","Amazon Web Services","Google Cloud","Microsoft Azure","IBM Cloud","Oracle Cloud",
  "Alibaba Cloud","Tencent Cloud","VMware","Nutanix","HPE","Dell Technologies","NetApp",
  "Broadcom","Red Hat","Canonical","SUSE","Mirantis",
  // Cybersecurity
  "CrowdStrike","Palo Alto Networks","Fortinet","Zscaler","Darktrace","SentinelOne",
  "CyberArk","Okta","Check Point","Sophos","Trend Micro","Broadcom (Symantec)","Trellix",
  "Mimecast","Proofpoint","Rapid7","Qualys","Tenable","Arctic Wolf","eSentire",
  "Secureworks","ReliaQuest","CrowdStrike Falcon","Abnormal","IRONSCALES",
  // Analytics / AI / Data
  "Palantir","Snowflake","Databricks","MicroStrategy","Qlik","Tableau","Power BI","Sisense",
  "ThoughtSpot","Domo","GoodData","Incorta","SAS","Alteryx","Dataiku","DataRobot",
  "Informatica","Talend","Boomi","MuleSoft","Fivetran","Matillion","SnapLogic","TIBCO",
  "Collibra","Alation","Atlan","Denodo","Confluent","Palantir Foundry",
  // ITSM / Monitoring
  "ServiceNow","BMC","BMC Helix","Ivanti","Freshservice","Dynatrace","Datadog","Splunk",
  "New Relic","SolarWinds","ManageEngine","LogicMonitor","Elastic","Grafana Labs",
  // Outsourcing / Managed Services
  "HCLSoftware","Unisys","DXC Technology","Kyndryl","Conduent","Exela Technologies",
  "EXL","Genpact","WNS","Sutherland","Datamatics",
  // Automation / RPA
  "UiPath","Automation Anywhere","SS&C Blue Prism","Laiye","Nintex","Workato",
  "Jitterbit","Celigo","Frends","ABBYY","Celonis",
  // CPaaS / Telecom
  "Twilio","Infobip","Route Mobile","Sinch","Tanla","Vonage","Bandwidth","8x8",
  "RingCentral","Zoom","Tata Communications","Cisco","Genesys","NICE","Talkdesk",
  // Network / SD-WAN
  "Juniper","Arista Networks","Extreme Networks","HPE Aruba","Cambium Networks","Allied Telesis",
  "Fortinet","Versa Networks","Cato Networks","Cloudflare","Zscaler",
  // Storage / Backup
  "Veeam","Commvault","Rubrik","Cohesity","Veritas","Druva","Arcserve","HYCU",
  // BPA / Contract
  "Icertis","Ironclad","Sirion","Agiloft","DocuSign","Coupa","GEP","Conga",
  // Dev / DevSecOps
  "GitHub","GitLab","Atlassian","JetBrains","JFrog","Snyk","Checkmarx","Veracode",
  // ECommerce
  "Shopify","BigCommerce","commercetools","Elastic Path","Spryker","VTEX",
  // Telecom vendors
  "Ericsson","Nokia","Huawei","Samsung","ZTE","Mavenir","NEC",
  // Logistics
  "Blue Yonder","FourKites","project44","Shippeo","Overhaul","Blume Global",
  // Payments / Finance
  "HighRadius","BlackLine","FIS","Stripe","Zuora","Recurly","Chargebee",
  // IoT / Manufacturing
  "PTC","Siemens","Rockwell Automation","GE Vernova","ABB","AVEVA","Tulip","42Q",
  // Other notable
  "Amdocs","AsiaInfo","Comviva","Flytxt","Subex","Tecnotree","Whale Cloud Technology",
];

// SI / Implementation partner master list
export const SI_PARTNERS = [
  // Big 4
  "Accenture","Deloitte","EY","PwC","KPMG",
  // Tier 1 Global SI
  "TCS","Tata Consultancy Services","Infosys","Wipro","HCLTech","Capgemini",
  "Cognizant","IBM Consulting","IBM","NTT DATA","LTIMindtree","Tech Mahindra",
  "DXC Technology","Fujitsu","CGI","Atos","Eviden",
  // Tier 2 specialist
  "Hexaware","Mphasis","Persistent Systems","Stefanini","Avanade","Slalom",
  "Publicis Sapient","Genpact","EPAM","Globant","Endava","Encora","SoftServe",
  "Thoughtworks","Virtusa","UST","Mastek","Coforge","Birlasoft","Cybage",
  "LTI Mindtree","SLK Software","HTC Global Services","Jade Global",
  // Indian mid-tier
  "3i Infotech","ACL Digital","Aspire Systems","ATSG","BTCO","Cloud4C",
  "Computacenter","Dataart","GFT","Happiest Minds","Indium","Innover Digital",
  "Iris Software","Maverick Systems","Mphasis","NIIT Technologies",
  "Orion Innovation","Persistent System","Quantiphi","Sonata Software",
  "SLK Software","Synechron","Xebia","Xoriant","Zensar Technologies",
  // Boutique / regional
  "Rizing","Seidor","SNP Group","All for One Group","Rimini Street","Amdocs",
  "Netcracker","Getronics","Ricoh","Stefanini","Unisys",
  // Vendor own consulting
  "SAP Consulting","Oracle Consulting","Microsoft Consulting Services","MCS",
  "Salesforce Professional Services","AWS Professional Services",
  "Google Cloud Professional Services","Workday Consulting",
];

export const VENDOR_ALIASES = {
  "SAP SE": "SAP","SAP AG": "SAP","SAP Inc": "SAP",
  "Oracle Corporation": "Oracle","Oracle Corp": "Oracle",
  "Microsoft Corp": "Microsoft","Microsoft Corporation": "Microsoft",
  "Amazon Web Services": "AWS","Amazon AWS": "AWS",
  "Google Cloud Platform": "Google Cloud","GCP": "Google Cloud",
  "International Business Machines": "IBM","IBM Corp": "IBM",
  "Tata Consultancy Services": "TCS","TCS Ltd": "TCS",
  "HCL Technologies": "HCLTech","HCL Tech": "HCLTech",
  "Ernst & Young": "EY","PricewaterhouseCoopers": "PwC",
  "Deloitte LLP": "Deloitte","Deloitte Touche": "Deloitte",
  "Capgemini SE": "Capgemini",
  "Cognizant Technology Solutions": "Cognizant",
  "Salesforce.com": "Salesforce","SFDC": "Salesforce",
  "Workday Inc": "Workday","Blue Yonder Group": "Blue Yonder",
  "LTI": "LTIMindtree","Mindtree": "LTIMindtree",
};
