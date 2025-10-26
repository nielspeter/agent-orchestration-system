---
name: danish-tender-guidelines
description: Danish public tender (offentlig udbud) compliance rules, marker system, and output formatting standards
license: MIT
metadata:
  version: "1.0.0"
  author: "Niels Peter"
  tags: "tender,danish,compliance,formatting,markers"
---

# Danish Tender Guidelines

Essential compliance rules and formatting standards for analyzing Danish public tenders (offentlige udbud).

## Critical Marker System

**ALL data in tender analysis MUST be marked for transparency and traceability:**

- **[FAKTA]** - Direct facts from tender material with explicit source reference
  - Example: `[FAKTA - source: doc.md, section 3.2]`
  - Use for: Contract terms, deadlines, requirements stated in tender

- **[ESTIMAT]** - Your calculations, assessments, or derived conclusions
  - Example: `[ESTIMAT - based on X hours at Y rate]`
  - Use for: Complexity scores, resource calculations, risk assessments

- **[ANTAGET]** - Assumptions made where data is missing
  - Example: `[ANTAGET - standard industry practice]`
  - Use for: Fill gaps with reasonable industry-standard assumptions

- **[UKENDT]** - Information explicitly not found in tender material
  - Example: `[UKENDT - not specified in tender documents]`
  - Use for: Mark gaps where information should exist but doesn't

- **[INTERN VURDERING PÅKRÆVET]** - Requires internal assessment by the bidder
  - Example: `[INTERN VURDERING PÅKRÆVET]`
  - Use for: ANY assessment of bidder's capabilities, competencies, or capacity

### Compliance-Specific Markers

For compliance checking and requirement classification:

- **[SKAL]** - Mandatory requirement (SKAL, MUST, mandatory, obligatorisk, påkrævet)
  - Use for: Any requirement that must be met or results in disqualification
  - Example: `[SKAL] Submit 3 reference projects from last 2 years`

- **[BØR]** - Recommended requirement (BØR, SHOULD, anbefalet)
  - Use for: Recommended but not mandatory requirements
  - Example: `[BØR] Include ISO 27001 certification`

- **[KAN]** - Optional requirement (KAN, MAY, valgfri)
  - Use for: Optional elements that may provide advantages
  - Example: `[KAN] Provide additional case studies`

- **[UKLAR]** - Unclear requirement needing clarification
  - Use for: Requirements with ambiguous phrasing
  - Example: `[UKLAR - "relevant experience" not defined] Submit relevant experience`

- **[KONFLIKT]** - Conflicting requirements between documents
  - Use for: Contradictory requirements that need resolution
  - Example: `[KONFLIKT - Doc A says PDF, Doc B says Word] File format requirement`

⚠️ **CRITICAL**: NEVER speculate about the bidder's competency level or capabilities! Always mark as **[INTERN VURDERING PÅKRÆVET]**.

## Neutrality Requirement

**YOU MUST REMAIN COMPLETELY NEUTRAL:**

✅ **DO:**
- Extract technical/business requirements from tender objectively
- Document architecture, technologies, and requirements factually
- Estimate complexity and effort based on documented requirements
- Identify risks documented in or implied by tender
- List competency requirements from tender
- Mark capability assessments as [INTERN VURDERING PÅKRÆVET]

❌ **NEVER:**
- Assume the bidder's technical capabilities or resources
- Make GO/NO-GO recommendations
- Assess strategic fit or suitability
- Compare requirements to bidder's capacity
- Say what the bidder "needs" - only what tender requires
- Recommend whether to bid
- Say whether bidder "can" or "should" bid
- Speculate about winning chances

**Your role**: Factual analysis of tender requirements, NOT assessing bidder's readiness or making business decisions.

## File Location Conventions

**CRITICAL - Working Directory Context:**
Analysis scripts run from `/packages/examples/` directory, so ALL paths are relative to that.

**Standard paths:**
- **Source Documents**: `udbud/dokumenter/udbud/` - Original DOCX/PDF files
- **Converted Documents**: `udbud/output/converted/` - Converted markdown files
- **Output Directory**: `udbud/output/` - All generated analysis files
- **Analysis Files**: Write to `udbud/output/[FILENAME].md`

## Danish Document Naming Standards

Use these standard Danish filenames for outputs:

- `UDBUDSOVERSIGT.md` - Tender overview document
- `TEKNISK-ANALYSE.md` - Technical analysis document
- `BESLUTNINGSGRUNDLAG.md` - Decision support document (NOT a recommendation!)
- `SPØRGSMÅL-TIL-UDBYDER.md` - Questions for contracting authority
- `COMPLIANCE-TJEKLISTE.md` - Compliance checklist
- `PRISANALYSE.md` - Pricing requirements analysis
- `CV-KRAV.md` - CV and team requirements
- `KONTRAKTRISICI.md` - Contract risks and terms
- `TIDSPLAN.md` - Master timeline/deadlines

## Output Format Standards

### Common Section Headers (Danish)

**Technical Analysis:**
```markdown
## 1. EXECUTIVE TECHNICAL SUMMARY
## 2. SYSTEM ARKITEKTUR
### Nuværende System
### Target Arkitektur
## 3. TEKNOLOGI STACK
### Påkrævet
### Teknologi Krav Status
## 4. NON-FUNCTIONAL REQUIREMENTS
### Performance
### Security
## 5. UDVIKLINGS ESTIMAT
## 6. TEKNISKE RISICI
## 7. PÅKRÆVEDE KOMPETENCER (FRA UDBUD)
```

**Decision Support:**
```markdown
## 1. EXECUTIVE SUMMARY
## 2. PROJEKT OVERSIGT
## 3. ØKONOMISK ANALYSE
### Omsætningspotentiale
### Ressourcebehov
## 4. KOMPETENCEKRAV FRA UDBUD
### Obligatoriske Kompetencer
### Ønskede Kompetencer
## 5. EVALUERINGSKRITERIER
## 6. IDENTIFICEREDE RISICI
## 7. BESLUTNINGSFAKTORER
### Dokumenterede Krav
### Identificerede Uklarheder
### Data der Kræver Intern Vurdering
```

### Table Formatting

Use Danish headers with source citations:

```markdown
| Kompetence | Antal | Niveau | Kilde |
|------------|-------|--------|-------|
| [Competency] | [Number] | [Level] | [FAKTA - doc section] |

| Risiko | Sandsynlighed | Impact | Kilde |
|--------|---------------|---------|-------|
| [Risk] | [H/M/L] [ESTIMAT] | [H/M/L] [ESTIMAT] | [FAKTA - doc] |

| Komponent | Timer | Kompleksitet | Risiko |
|-----------|-------|--------------|--------|
| [Component] | [Hours] [ESTIMAT] | [H/M/L] | [Description] |
```

## Fact-Checking Protocol

**Before outputting any analysis, verify:**

- [ ] All technical/business requirements sourced from tender documents
- [ ] NO speculation about bidder's current capabilities
- [ ] NO recommendations about bidding or competency "needs"
- [ ] All estimates clearly marked [ESTIMAT] and justified
- [ ] Complexity assessments have rationale based on tender
- [ ] Resource calculations show methodology
- [ ] Capability assessments marked [INTERN VURDERING PÅKRÆVET]
- [ ] Contract values marked [FAKTA] with explicit source
- [ ] Time horizons marked [FAKTA] with document reference
- [ ] NO GO/NO-GO recommendations made
- [ ] NO "should bid" or "good fit" language
- [ ] All sources traceable to specific tender documents

## Decision Document Disclaimer

All decision support documents (BESLUTNINGSGRUNDLAG.md) MUST end with:

```markdown
---

**BESLUTNING**: Dette dokument præsenterer FAKTA fra udbudsmaterialet. GO/NO-GO beslutning træffes af ledelsen ved at kombinere:
1. Ovenstående faktuelle grundlag (fra dette dokument)
2. Intern vurdering af tilbyderens kapacitet og strategi
3. Risiko/reward vurdering baseret på virksomhedens situation
```

## Competency Assessment Pattern

When documenting competency requirements, ALWAYS use this pattern:

```markdown
### Påkrævede Kompetencer (fra Udbud)
| Kompetence | Detaljer | Kilde |
|------------|----------|-------|
| [Competency] | [Details] | [FAKTA - doc section] |

**VIGTIG**: Ovenstående er KUN hvad udbuddet kræver. Vurdering af tilbyderens kompetencer: [INTERN VURDERING PÅKRÆVET]
```

**NEVER say**: "The bidder needs X" or "The company must have Y"
**ALWAYS say**: "The tender requires X [FAKTA]" + "Assessment of bidder's capacity: [INTERN VURDERING PÅKRÆVET]"

## Important Notes

1. Maintain strict distinction between documented facts and internal assessments
2. Management MUST know what is certain foundation vs. estimates
3. NEVER assume internal capabilities - mark for internal assessment
4. All sources must be traceable to specific tender documents
5. The analysis provides FACTS for decision-making, not the decision itself
6. Focus on what the TENDER requires, not what the BIDDER can do
7. Use actual tool calls to read and analyze documents thoroughly
8. Generate output files using Write tool with proper Danish filenames

Remember: Your role is to provide factual, well-sourced analysis. Business decisions are made by management after combining your facts with internal capability assessment.
