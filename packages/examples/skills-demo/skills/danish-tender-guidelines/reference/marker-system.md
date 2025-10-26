# Danish Tender Marker System - Detailed Guide

## Overview

The marker system ensures transparency, traceability, and accountability in tender analysis. Every piece of data must be clearly marked to show its origin and reliability level.

## The Five Core Markers

### 1. [FAKTA] - Facts from Tender Documents

**Purpose**: Mark information directly extracted from official tender material

**When to use:**
- Contract terms stated in tender
- Deadlines published in tender
- Requirements explicitly listed
- Evaluation criteria from tender
- Project descriptions from tender
- Budget/pricing information in tender
- SLA/performance requirements stated
- Qualification requirements listed

**Format**: `[FAKTA - source: document.md, section X.Y]`

**Examples:**
```markdown
- Contract duration: 3 years [FAKTA - source: kontrakt.md, section 2.1]
- Submission deadline: 2025-11-15 [FAKTA - source: udbudsbetingelser.md, page 3]
- Required response time: < 4 hours [FAKTA - source: SLA.md, section 4.2]
- Minimum team size: 5 FTE [FAKTA - source: krav.md, section 6.1]
```

**Best practices:**
- Always include document name
- Include section/page number when available
- Quote exact text if important
- Cite multiple sources if requirement appears in multiple places

### 2. [ESTIMAT] - Calculations and Assessments

**Purpose**: Mark your own calculations, assessments, or derived conclusions

**When to use:**
- Complexity scores you calculate
- Resource estimations you derive
- Risk assessments you make
- Cost projections you calculate
- Timeline estimates you create
- Effort calculations based on requirements

**Format**: `[ESTIMAT - based on X]` where X explains your methodology

**Examples:**
```markdown
- Development effort: 800 hours [ESTIMAT - based on 5 microservices * 160h average]
- Integration complexity: 7/10 [ESTIMAT - based on 15 external systems + legacy DB migration]
- Project risk level: HIGH [ESTIMAT - due to tight deadline + unproven technology stack]
- Annual revenue: 2.5M DKK [ESTIMAT - 2000 hours/year * 1250 DKK/hour average rate]
```

**Best practices:**
- Always explain calculation methodology
- Show your work (formulas, assumptions used)
- Reference facts used in calculation
- Be conservative in estimates
- Note confidence level if appropriate

### 3. [ANTAGET] - Assumptions

**Purpose**: Mark assumptions made to fill gaps in tender documentation

**When to use:**
- Industry-standard practices applied
- Missing technical details filled with common practice
- Gaps filled with reasonable assumptions
- Best practices assumed when not specified

**Format**: `[ANTAGET - assumption description]`

**Examples:**
```markdown
- Development methodology: Scrum [ANTAGET - not specified, using industry standard]
- Database: PostgreSQL or similar [ANTAGET - SQL database requirement stated, specific DB not mandated]
- Code review required [ANTAGET - quality requirements high, but process not detailed]
- Testing: Unit + Integration + E2E [ANTAGET - "comprehensive testing" mentioned but not detailed]
```

**Best practices:**
- Use only when necessary (prefer [FAKTA] or [UKENDT])
- Choose reasonable, conservative assumptions
- Note if assumption needs validation
- Mark high-risk assumptions specially

### 4. [UKENDT] - Unknown/Missing Information

**Purpose**: Mark information explicitly not found in tender material

**When to use:**
- Expected information is missing
- Tender is ambiguous or unclear
- Critical details not provided
- Questions need clarification

**Format**: `[UKENDT - what is missing]`

**Examples:**
```markdown
- API authentication method: [UKENDT - not specified in tender]
- Database migration strategy: [UKENDT - current system details not provided]
- Production environment specs: [UKENDT - infrastructure requirements missing]
- Integration testing responsibility: [UKENDT - roles not clearly defined]
```

**Best practices:**
- Be specific about what is unknown
- Note impact of missing information
- Flag for clarification questions
- Don't assume - mark as unknown

### 5. [INTERN VURDERING PÅKRÆVET] - Internal Assessment Required

**Purpose**: Mark where bidder's internal capabilities must be assessed

**When to use - ALWAYS for:**
- Any assessment of bidder's technical capabilities
- Evaluation of bidder's resource availability
- Assessment of bidder's competency levels
- Bidder's experience with similar projects
- Bidder's strategic interest in contract
- Bidder's financial capacity
- Bidder's team availability
- Bidder's existing client commitments
- Whether bidder "can" or "should" bid

**Format**: `[INTERN VURDERING PÅKRÆVET]`

**Examples:**
```markdown
**Tender requires:** React + TypeScript development [FAKTA]
**Bidder's capability:** [INTERN VURDERING PÅKRÆVET]

**Tender requires:** 5 senior developers available full-time [FAKTA]
**Bidder's availability:** [INTERN VURDERING PÅKRÆVET]

**Tender requires:** Experience with healthcare systems [FAKTA]
**Bidder's experience:** [INTERN VURDERING PÅKRÆVET]
```

**CRITICAL RULE**:
**NEVER say:** "The company needs to hire X" or "We must have Y capability"
**ALWAYS say:** "Tender requires X [FAKTA]. Bidder capability: [INTERN VURDERING PÅKRÆVET]"

## Common Pitfalls and How to Avoid Them

### Pitfall 1: Mixing Facts and Estimates

❌ **Wrong:**
```markdown
- Required developers: 5 [FAKTA]
```

✅ **Correct:**
```markdown
- Required hours: 2000/year [FAKTA - source: krav.md]
- Estimated developers: 1.0 FTE [ESTIMAT - based on 2000 hours/year]
```

### Pitfall 2: Assuming Bidder Capabilities

❌ **Wrong:**
```markdown
- Technology: Kubernetes [FAKTA]
- Our team has Kubernetes experience [implied or stated]
```

✅ **Correct:**
```markdown
- Required technology: Kubernetes [FAKTA - source: tech-krav.md]
- Bidder's Kubernetes capability: [INTERN VURDERING PÅKRÆVET]
```

### Pitfall 3: Hidden Assumptions

❌ **Wrong:**
```markdown
- Testing effort: 200 hours [ESTIMAT]
```

✅ **Correct:**
```markdown
- Testing effort: 200 hours [ESTIMAT - assumes 20% of dev time per industry standard]
```

### Pitfall 4: Vague Sources

❌ **Wrong:**
```markdown
- Deadline: December 1st [FAKTA - from tender]
```

✅ **Correct:**
```markdown
- Deadline: 2025-12-01 kl. 12:00 [FAKTA - source: udbudsbetingelser.md, section 3.1]
```

### Pitfall 5: Making Recommendations

❌ **Wrong:**
```markdown
- Risk: High complexity [ESTIMAT]
- We should not bid on this [recommendation]
```

✅ **Correct:**
```markdown
- Risk: High complexity [ESTIMAT - 15 integrations + legacy migration]
- GO/NO-GO decision: [INTERN VURDERING PÅKRÆVET]
```

## Marker Combination Patterns

### Fact + Estimate
```markdown
- Annual hours required: 2000 [FAKTA - source: contract.md]
- Annual FTE requirement: 1.0 [ESTIMAT - 2000 hours / 2000 work hours per year]
```

### Fact + Internal Assessment
```markdown
- Required competency: AWS Solutions Architect certification [FAKTA - source: krav.md, section 5.2]
- Bidder team certification status: [INTERN VURDERING PÅKRÆVET]
```

### Unknown + Risk Flag
```markdown
- Production infrastructure details: [UKENDT - not specified in tender]
- **Risk**: Cannot accurately estimate infrastructure costs without this information
```

### Assumption + Justification
```markdown
- Code review process: Mandatory peer review [ANTAGET - "high quality code" requirement stated but process not detailed]
- Basis: Industry best practice for quality requirements similar to this tender
```

## Quality Checklist

Before finalizing any analysis document, verify:

- [ ] Every data point has a marker
- [ ] All [FAKTA] markers include source references
- [ ] All [ESTIMAT] markers explain calculation methodology
- [ ] All [ANTAGET] markers justify the assumption
- [ ] All [UKENDT] items are marked for clarification
- [ ] NO capability assessments made (all marked [INTERN VURDERING PÅKRÆVET])
- [ ] NO recommendations or "should" statements
- [ ] Sources are traceable and specific
- [ ] Methodology is transparent and reproducible

## Example: Complete Analysis Section

```markdown
## TEKNISKE KRAV ANALYSE

### Backend Udvikling
- **Sprog**: Java 17+ [FAKTA - source: tech-spec.md, section 2.1]
- **Framework**: Spring Boot [FAKTA - source: tech-spec.md, section 2.1]
- **Database**: PostgreSQL 14+ [FAKTA - source: tech-spec.md, section 2.3]
- **Estimeret udviklingstid**: 400 timer [ESTIMAT - based på 5 REST endpoints * 80 timer average]
- **Bidder's Java/Spring capability**: [INTERN VURDERING PÅKRÆVET]

### Integration
- **Antal systemer**: 8 eksterne systemer [FAKTA - source: integration-spec.md]
- **Protokol**: REST API [FAKTA - 6 systems], SOAP [FAKTA - 2 systems]
- **Auth metode**: [UKENDT - not specified in tender documents]
- **Integration kompleksitet**: 8/10 [ESTIMAT - due to 2 legacy SOAP systems + auth uncertainty]
- **Estimeret integration tid**: 320 timer [ESTIMAT - 8 systems * 40 timer average]

### Risiko Vurdering
- **Legacy SOAP integration**: HIGH risk [ESTIMAT - limited documentation in tender + older technology]
- **Missing auth specs**: MEDIUM risk [based on [UKENDT] auth method]
- **Timeline**: 6 months [FAKTA - source: timeline.md]
- **Timeline feasibility**: [INTERN VURDERING PÅKRÆVET - requires assessment of bidder's team availability]
```

This shows proper use of all marker types with clear sourcing and methodology.
