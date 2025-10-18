# COMPLIANCE & QUALITY CHECKLIST
Tender: [Tender Name/ID]
Analysis Date: [YYYY-MM-DD]
Reviewer: [Name/Role]

---

## 1. DOCUMENT COMPLETENESS

### Required Analysis Documents
- [ ] UDBUDSOVERSIGT.md - Overview document exists
- [ ] TEKNISK-ANALYSE.md - Technical analysis exists
- [ ] BESLUTNINGSGRUNDLAG.md - Decision support document exists
- [ ] SPØRGSMÅL-TIL-UDBYDER.md - Questions document (if applicable)
- [ ] COMPLIANCE-TJEKLISTE.md - This checklist completed

### Optional Documents (if applicable)
- [ ] PRISANALYSE.md - Pricing analysis (if financial modeling done)
- [ ] CV-KRAV.md - CV requirements analysis (if detailed)
- [ ] KONTRAKTRISICI.md - Contract risks (if extensive)
- [ ] TIDSPLAN.md - Master timeline (if complex)

---

## 2. MARKER SYSTEM COMPLIANCE

### Every Data Point Marked
- [ ] All factual claims have [FAKTA] marker
- [ ] All calculations have [ESTIMAT] marker
- [ ] All assumptions have [ANTAGET] marker
- [ ] All missing info has [UKENDT] marker
- [ ] All capability assessments have [INTERN VURDERING PÅKRÆVET] marker
- [ ] NO unmarked data points found

### [FAKTA] Marker Quality
- [ ] All [FAKTA] include source document name
- [ ] All [FAKTA] include section/page reference
- [ ] Important [FAKTA] include exact quotes where critical
- [ ] Multi-source citations when requirement appears in multiple places
- [ ] NO vague sources ("from tender", "in documents")

### [ESTIMAT] Marker Quality
- [ ] All [ESTIMAT] explain calculation methodology
- [ ] Formulas shown where applicable
- [ ] Assumptions noted if used in calculation
- [ ] Facts used in estimates are referenced
- [ ] Conservative estimates preferred over optimistic

### [ANTAGET] Marker Quality
- [ ] Assumptions justified with industry standards or rationale
- [ ] Only used where necessary (not replacing [FAKTA] or [UKENDT])
- [ ] Reasonable, conservative assumptions chosen
- [ ] High-risk assumptions flagged specially

### [UKENDT] Marker Quality
- [ ] Specific about what information is missing
- [ ] Impact of missing information noted
- [ ] Flagged for clarification questions
- [ ] NO assumptions made where [UKENDT] is appropriate

### [INTERN VURDERING PÅKRÆVET] Usage
- [ ] Used for ALL bidder capability assessments
- [ ] NO speculation about bidder's technical abilities
- [ ] NO statements about bidder's team availability
- [ ] NO assessment of bidder's experience level
- [ ] NO "company needs X" statements

---

## 3. NEUTRALITY COMPLIANCE

### Objective Analysis
- [ ] Technical requirements extracted objectively from tender
- [ ] NO assumptions about bidder's capabilities
- [ ] NO GO/NO-GO recommendations made
- [ ] NO strategic fit assessments
- [ ] NO "should bid" or "good fit" language

### Capability Assessment Separation
- [ ] Tender requirements clearly separated from bidder assessment
- [ ] Competency tables include footer: "Ovenstående er KUN hvad udbuddet kræver. Vurdering af tilbyderens kompetencer: [INTERN VURDERING PÅKRÆVET]"
- [ ] NO mixing of "tender requires X" with "company has Y"
- [ ] Resource needs from tender vs bidder availability clearly distinguished

### Language Neutrality
- [ ] NO "we need" statements (use "tender requires")
- [ ] NO "our team" references
- [ ] NO "must hire" or "must have" directed at bidder
- [ ] Recommendations limited to factual implications (not business decisions)

---

## 4. DOCUMENT STRUCTURE COMPLIANCE

### Technical Analysis Structure
- [ ] Section 1: Executive Technical Summary
- [ ] Section 2: System Arkitektur (Current + Target)
- [ ] Section 3: Teknologi Stack (Required + Desired)
- [ ] Section 4: Non-Functional Requirements
- [ ] Section 5: Udviklings Estimat
- [ ] Section 6: Tekniske Risici
- [ ] Section 7: Påkrævede Kompetencer (fra Udbud)
- [ ] Section 8: Tekniske Overvejelser
- [ ] All sections in correct order

### Decision Support Structure
- [ ] Section 1: Executive Summary
- [ ] Section 2: Projekt Oversigt
- [ ] Section 3: Økonomisk Analyse
- [ ] Section 4: Kompetencekrav fra Udbud
- [ ] Section 5: Evalueringskriterier
- [ ] Section 6: Identificerede Risici
- [ ] Section 7: Evalueringskriterie Fordeling
- [ ] Section 8: Projektbeskrivelse Sammenfatning
- [ ] Section 9: Beslutningsfaktorer
- [ ] Mandatory footer with decision disclaimer present
- [ ] All sections in correct order

### Headers and Formatting
- [ ] Section numbers used consistently (1., 2., 3., etc.)
- [ ] Danish headers for main sections
- [ ] Proper capitalization (TEKNISK ANALYSE, BESLUTNINGSGRUNDLAG)
- [ ] Subsection headers properly nested (###)

---

## 5. TABLE FORMATTING COMPLIANCE

### Technology Requirements Table
- [ ] Headers: Teknologi | Version | Krav | Kilde
- [ ] All rows have complete source citations
- [ ] Version numbers specific (not "latest" unless in tender)
- [ ] Krav level accurate (MUST/SHOULD matches tender)

### Competency Requirements Table
- [ ] Headers: Kompetence | Antal | Niveau | Kilde (or similar)
- [ ] All data from tender documents ([FAKTA])
- [ ] Footer disclaimer present
- [ ] NO bidder capability assessments in table

### Risk Analysis Table
- [ ] Headers: Risiko | Sandsynlighed | Impact | Kilde
- [ ] Risk source properly cited ([FAKTA] or [ESTIMAT])
- [ ] Likelihood and impact marked [ESTIMAT]
- [ ] H/M/L scale used consistently

### Effort Estimation Table
- [ ] Headers: Komponent | Timer | Kompleksitet | Risiko (or similar)
- [ ] All estimates marked [ESTIMAT]
- [ ] Methodology shown for each estimate
- [ ] Complexity justified

---

## 6. LANGUAGE COMPLIANCE

### Danish Terminology
- [ ] "Udbud" (not "tender" in Danish sections)
- [ ] "Udbyder" for contracting authority
- [ ] "Tilbyder" for bidder
- [ ] "Kompetence" for competency
- [ ] "Påkrævet" for required
- [ ] "Ønsket" for desired
- [ ] Danish section titles throughout

### Mixed Language Pattern
- [ ] Titles and headers in Danish
- [ ] Table headers in Danish
- [ ] Markers in English ([FAKTA], [ESTIMAT], etc.)
- [ ] Technical terms in English (REST API, PostgreSQL)
- [ ] Requirement prose in Danish

---

## 7. DATA QUALITY

### Completeness
- [ ] All critical requirements extracted from tender
- [ ] All deadlines identified and extracted
- [ ] All competency requirements documented
- [ ] All technical requirements captured
- [ ] Economic parameters extracted
- [ ] Evaluation criteria documented

### Accuracy
- [ ] Dates in ISO format (YYYY-MM-DD)
- [ ] Times include "kl." prefix (Danish convention)
- [ ] Numbers precise (not rounded unless from tender)
- [ ] Quotes exact when used
- [ ] Technical terms spelled correctly

### Traceability
- [ ] Every [FAKTA] traceable to specific tender document
- [ ] Section/page references accurate
- [ ] Multiple sources cited when requirement duplicated
- [ ] Document names match actual files in converted/ folder

---

## 8. DEADLINE COMPLIANCE

### Deadline Extraction
- [ ] Tilbudsfrist (submission) extracted with exact time
- [ ] Spørgsmålsfrist (questions) extracted if stated
- [ ] Kontraktstart (contract start) extracted
- [ ] All milestones extracted with dates
- [ ] Holiday conflicts identified if applicable

### Timeline Analysis
- [ ] Working days vs calendar days clarified
- [ ] Danish holidays accounted for if in deadline period
- [ ] Backward planning from submission deadline provided
- [ ] Timeline feasibility assessed [ESTIMAT]
- [ ] Deadline risks identified

---

## 9. RISK IDENTIFICATION

### Technical Risks
- [ ] Integration complexity risks identified
- [ ] Technology maturity risks noted
- [ ] Performance requirement risks assessed
- [ ] Security/compliance risks documented
- [ ] Data migration risks evaluated

### Timeline Risks
- [ ] Tight deadline risks flagged
- [ ] Holiday period conflicts noted
- [ ] Question deadline status checked
- [ ] Milestone feasibility assessed

### Information Gaps
- [ ] All [UKENDT] items compiled
- [ ] Impact of missing information assessed
- [ ] Questions for clarification prepared
- [ ] Critical gaps vs nice-to-have distinguished

---

## 10. ECONOMIC ANALYSIS

### Revenue Calculations
- [ ] Annual revenue estimated [ESTIMAT] with methodology
- [ ] Total contract value calculated [ESTIMAT]
- [ ] Pricing model from tender documented [FAKTA]
- [ ] Payment terms extracted [FAKTA]

### Resource Calculations
- [ ] Annual hours from tender [FAKTA]
- [ ] FTE conversion calculated [ESTIMAT] with formula (hours/2000)
- [ ] Resource breakdown by role/skill provided
- [ ] Resource estimates conservative

---

## 11. COMPETENCY DOCUMENTATION

### Extraction Quality
- [ ] Obligatory competencies separated from desired
- [ ] Number of people per competency documented
- [ ] Seniority level (Junior/Senior/Expert) noted
- [ ] Certification requirements extracted
- [ ] Experience requirements documented

### Separation from Bidder Assessment
- [ ] Table shows ONLY tender requirements
- [ ] Footer disclaimer present
- [ ] NO bidder capability statements
- [ ] Internal assessment clearly marked as required

---

## 12. QUESTIONS FOR CONTRACTING AUTHORITY

### [UKENDT] Items Converted to Questions
- [ ] All critical [UKENDT] items have draft questions
- [ ] Questions specific and clear
- [ ] Business reason for question noted
- [ ] Questions prioritized (critical vs nice-to-have)

### Question Quality
- [ ] Professional Danish language
- [ ] Reference to tender section if applicable
- [ ] Clear about what information is needed
- [ ] Why information is important explained

---

## 13. FINAL DOCUMENT QUALITY

### Readability
- [ ] Executive summaries concise (3-5 sentences)
- [ ] Tables properly formatted
- [ ] Bullet points used appropriately
- [ ] Paragraph breaks logical
- [ ] NO walls of text

### Professional Quality
- [ ] NO spelling errors
- [ ] NO grammar errors
- [ ] Consistent terminology throughout
- [ ] Professional tone maintained
- [ ] NO informal language

### Metadata
- [ ] Document title clear
- [ ] Generation date present
- [ ] Tender name/ID included
- [ ] Source documents listed

---

## 14. CROSS-DOCUMENT CONSISTENCY

### Data Consistency
- [ ] Dates same across all documents
- [ ] Numbers consistent (e.g., contract value same in all files)
- [ ] Deadlines match across documents
- [ ] Technology requirements consistent
- [ ] Resource estimates aligned

### No Contradictions
- [ ] Technical complexity consistent with effort estimates
- [ ] Risk levels aligned with mitigation needs
- [ ] Timeline assessments consistent
- [ ] NO conflicting statements between documents

---

## 15. SPECIFIC VALIDATION CHECKS

### For Each [FAKTA] Marker
Pick 10 random [FAKTA] markers and verify:
- [ ] 1. [Specific citation] - verified against source document
- [ ] 2. [Specific citation] - verified against source document
- [ ] 3. [Specific citation] - verified against source document
- [ ] 4. [Specific citation] - verified against source document
- [ ] 5. [Specific citation] - verified against source document
- [ ] 6. [Specific citation] - verified against source document
- [ ] 7. [Specific citation] - verified against source document
- [ ] 8. [Specific citation] - verified against source document
- [ ] 9. [Specific citation] - verified against source document
- [ ] 10. [Specific citation] - verified against source document

### For Each [ESTIMAT] Marker
Pick 5 random [ESTIMAT] markers and verify:
- [ ] 1. [Specific estimate] - methodology clear and reasonable
- [ ] 2. [Specific estimate] - methodology clear and reasonable
- [ ] 3. [Specific estimate] - methodology clear and reasonable
- [ ] 4. [Specific estimate] - methodology clear and reasonable
- [ ] 5. [Specific estimate] - methodology clear and reasonable

---

## 16. SUBMISSION READINESS

### For Management Review
- [ ] All documents professional quality
- [ ] Clear separation of facts vs estimates vs unknowns
- [ ] Decision support information complete
- [ ] Risks clearly identified
- [ ] NO business decisions made by analysis

### For Tender Response Preparation
- [ ] All tender requirements identified
- [ ] Competency requirements clear
- [ ] Timeline understood
- [ ] Evaluation criteria documented
- [ ] Gaps/questions identified for clarification

---

## FINAL SIGN-OFF

**Reviewer**: [Name]
**Date**: [YYYY-MM-DD]
**Overall Assessment**: [PASS / NEEDS REVISION / FAIL]

**Issues Found**: [Number]
- Critical: [Number]
- Medium: [Number]
- Minor: [Number]

**Required Actions**:
1. [Action item if any issues found]
2. [Action item]
3. [Action item]

**Approval Status**:
- [ ] Ready for management review
- [ ] Ready for tender response team
- [ ] Needs revision (see issues above)

---

**CHECKLIST COMPLETE**

*This checklist ensures all Danish tender analysis documents meet quality, compliance, and neutrality standards.*
