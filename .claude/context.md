# Project Context

## Project Overview
**CoopXV** is a B2B poultry farm monitoring platform that provides near real-time health reporting and early detection for chicken flocks. Smart sensors in chicken coops (לולים) feed data into CoopXV's analysis engine, which generates health reports, performance metrics, stress alerts, and actionable recommendations for farmers and supervisors.

**Core value proposition:** "Catch problems before they become losses - real-time flock monitoring and early detection."

## Target Users

### Primary Users
- **Grower (מגדל)** - Operates a single farm. Checks their own coops daily. Needs simple green/yellow/red status. Cares about flock health, performance vs prediction, and actionable recommendations. Sees only their own farm's coops.
- **Instructor (מדריך)** - Supervisor sent by the purchasing company/cooperative. Oversees multiple farms under one organization. Checks all assigned farms every morning. Needs a high-level dashboard across farms with drill-down capability. Sees all coops under their organization.
- **Vet (רופא)** - Veterinarian with organization-level access (same as instructor). Focuses on health alerts, stress patterns, and disease risk indicators across multiple farms.

### Administrative Users
- **Admin (מנהל מערכת)** - Full system access plus user management. Manages users, system settings, and organizational configuration.

### User Behavior
- **Current workflow:** CoopXV sensors collect data → Excel files generated per coop/flock → instructors and vets manually review Excel files → decisions on flock health
- **Pain points:** Manual Excel review is slow, easy to miss patterns, no real-time alerts, no cross-farm comparison, hard to spot trends
- **What they want:** Instant health status, automated alerts for anomalies, performance tracking vs predictions, historical trends, mobile access for field use

## Target Audience Language
**Primary Language:** Hebrew (עברית)
**RTL Support:** Yes (MANDATORY)
**UI Language Priority:** Hebrew first, English fallback

### Language Verification Protocol
- ALL UI text (titles, labels, buttons, tooltips, errors, placeholders) must be in Hebrew
- Maya, Shira, Mark, and Lisa verify UI text in Hebrew FIRST
- English is fallback/secondary only
- RTL layout must be implemented throughout

## Data Hierarchy
```
Country (מדינה)
  └── Region (אזור) - e.g., Golan, Galilee
      └── Organization (ארגון) - cooperative/purchasing company
          └── Farm (משק/חווה) - physical farm location
              └── House/Coop (לול) - individual chicken house
                  └── Flock (להקה) - current batch of chickens with age tracking
```

## Domain Language
Key terms specific to the poultry monitoring industry:

- **לול (Coop/House)** - Individual chicken house building, the basic monitoring unit
- **להקה (Flock)** - Current batch of chickens in a coop, tracked by flock number and age in days
- **גיל (Age)** - Age of flock in days since placement
- **מגדל (Grower)** - Farmer who operates a farm
- **מדריך (Instructor)** - Supervisor/trainer sent by the purchasing company to oversee multiple farms
- **ארגון (Organization)** - Cooperative or purchasing company (e.g., Of-Galil, Of-Bar)
- **משק (Farm)** - Physical farm with one or more coops
- **הרגשה (Feeling)** - Flock wellness indicator (F1=stressed to F5=excellent)
- **ביצוע (Performance)** - Performance percentage vs system prediction (100% = on target)
- **משקל (Weight)** - Estimated flock weight in kg
- **צריכת מים (Water Consumption)** - Daily water intake in liters
- **פעילות (Activity)** - Hourly activity patterns compared to previous day
- **סטרס (Stress)** - Stress level indicator with disease warning threshold
- **המלצה (Recommendation)** - System-generated actionable advice
- **חריג (Alert/Anomaly)** - Abnormal reading requiring attention
- **תקין (Normal/OK)** - Within expected parameters
- **לבדיקה (Check/Warning)** - Needs investigation

## Known Organizations
| Organization | Hebrew | Known Farms |
|-------------|--------|-------------|
| Of-Galil | עוף הגליל | Ortal (5 coops), Amir, Golan, Mavo Hama, Ein Zivan |
| Of-Bar | עופ"ק בר | Kfar Masaryk, Ram On, Tel Yosef |
| Of-Oz | עופ"ק עוז | Baranes Home |
| Daliot | דליות | Daliot |
| RamGash | רמג"ש | RamGash |
| Sarid | שריד | 442 |

## System Architecture

### Data Flow
```
Coop Sensors → CoopXV Analysis Engine → Excel Files (CXV-*.xlsx)
                                       → BData Summary Files (per org)
                                       → Platform API → Dashboard UI
```

### File Naming Convention (sensor data)
- **Coop files:** `CXV-{version}_{FarmName}-{CoopNum}_{Period}.xlsx` (e.g., `CXV-928.5_Odem-1_C1-26.xlsx`)
- **Summary files:** `BData_{date}_{OrgName}.xlsx` (e.g., `BData_28.8_Of-Galil.xlsx`)

## UI Screens (Core)

### Screen 1: הלולים שלי (My Coops)
- Dashboard table of all coops under the user's access
- Columns: Farm, Coop, Flock, Age, Status (OK/Warning/Alert), Feeling (F1-F5), Performance %, Recommendation
- Summary stats: total coops, normal count, warning count, alert count
- Toggle: expanded/condensed view
- Click row → navigates to Coop Output

### Screen 2: פלט לול (Coop Output)
- Single coop detail view
- Feeling gauge (speedometer F1-F5)
- Performance gauge (% vs prediction)
- Hourly activity chart (today vs yesterday)
- Current hour recommendations
- 24h / 8-day lookback matrix (status per hour/day)
- Scrollable recommendations from last 24 hours
- Selectors: farm, coop, date, hour

### Screen 3: סקירה התפתחותית (Developmental Review)
- Long-term flock health trends
- Health notes with stress level chart
- Performance vs system prediction graph
- Growth day timeline (x-axis)
- Health alerts and warnings

## Current State
- **Production Client:** TBD
- **Production Server:** TBD
- **Backend:** Express 5 + MongoDB
- **Frontend:** React 18 + TypeScript + SCSS
- **Services:** client, server, mailer, uploader, scheduler
- **Styling:** SCSS + Bootstrap + MUI
- **Founder:** Eran Ater (Co-Founder & Chief Poultry Officer)

## Technical Constraints
- MongoDB (document-based, no relational joins)
- Sensor data arrives as Excel files (CXV format), not real-time stream
- Hebrew RTL layout required throughout
- Must work on mobile devices for field use
- Multi-service architecture (5 services in monorepo)

## Success Metrics
- **Adoption:** Number of cooperatives, farms, and coops onboarded
- **Engagement:** Daily active instructors checking dashboards
- **Detection:** Alerts triggered before human detection (early detection rate)
- **Accuracy:** Alert accuracy (true positives vs false alarms)
- **Response time:** Time from alert to farmer action

## External Documentation
- **Project docs location:** `C:\Users\UAVZone\OneDrive\0projects\לקוחות_עבודות\CoopXV`
- **Session protocol:** Check for new documents in the docs folder at session start

---

**Last Updated:** 2026-02-14
**Updated By:** Ronen (Team Lead)
