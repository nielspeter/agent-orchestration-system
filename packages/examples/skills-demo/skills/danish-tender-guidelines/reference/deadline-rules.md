# Danish Tender Deadline Management Rules

## Overview

Danish public tenders have strict deadline requirements. Missing a deadline can disqualify a bid entirely. This guide covers deadline extraction, calculation, and coordination.

## Critical Deadlines

### 1. Tilbudsfrist (Submission Deadline)

**What it is:** Final deadline for submitting the complete tender response.

**Format in tender documents:**
```
Tilbudsfrist: 2025-11-15 kl. 12:00
Deadline for submission: 15. november 2025 kl. 12:00
```

**How to mark:**
```markdown
Tilbudsfrist: 2025-11-15 kl. 12:00 [FAKTA - source: udbudsbetingelser.md, section 3.1]
```

**CRITICAL RULES:**
- ✅ Extract EXACT date and time (including timezone if specified)
- ✅ Use ISO date format (YYYY-MM-DD) in analysis
- ✅ Include "kl." (time) if specified
- ✅ Note if electronic vs physical submission
- ❌ NEVER estimate or assume deadline if not stated
- ❌ NEVER extend deadline in analysis

**If missing:**
```markdown
Tilbudsfrist: [UKENDT - not specified in tender documents]
**CRITICAL**: Cannot proceed without submission deadline. Mark as clarification question.
```

### 2. Spørgsmålsfrist (Question Deadline)

**What it is:** Last day to submit questions to the contracting authority.

**Format in tender documents:**
```
Spørgsmål skal indsendes senest: 2025-10-20 kl. 12:00
Questions deadline: 20. oktober 2025
```

**How to mark:**
```markdown
Spørgsmålsfrist: 2025-10-20 kl. 12:00 [FAKTA - source: udbudsbetingelser.md, section 2.3]
```

**CRITICAL RULES:**
- ✅ Usually 7-14 days before submission deadline
- ✅ Questions submitted after this are not guaranteed response
- ✅ Authorities typically respond 5-7 days before submission
- ✅ Responses published to ALL bidders

**If missing:**
```markdown
Spørgsmålsfrist: [UKENDT - not specified]
[ANTAGET - typical practice is 10 days before submission, but must be confirmed with authority]
```

### 3. Kontraktstart (Contract Start Date)

**What it is:** When the contract period begins (when work must commence).

**Format in tender documents:**
```
Kontraktstart: 1. januar 2026
Expected contract start: January 1, 2026
Arbejdet skal påbegyndes senest: 15. januar 2026 (work must begin by...)
```

**How to mark:**
```markdown
Kontraktstart: 2026-01-01 [FAKTA - source: kontrakt.md, section 4.1]
Arbejde påbegyndes senest: 2026-01-15 [FAKTA - source: kontrakt.md, section 4.2]
```

**CRITICAL RULES:**
- ✅ May be different from contract signature date
- ✅ Impacts team mobilization timeline
- ✅ May have penalties for late start
- ✅ Note if "no later than" (senest) vs exact date

### 4. Implementation Milestones

**What it is:** Key delivery dates during contract period.

**Format in tender documents:**
```
Milepæle:
- Fase 1: Afsluttet senest 31. marts 2026
- Fase 2: Afsluttet senest 30. juni 2026
- Go-live: Senest 1. september 2026
```

**How to mark:**
```markdown
| Milepæl | Deadline | Kilde |
|---------|----------|-------|
| Fase 1 afslutning | 2026-03-31 | [FAKTA - source: tidsplan.md, section 5.1] |
| Fase 2 afslutning | 2026-06-30 | [FAKTA - source: tidsplan.md, section 5.2] |
| Go-live | 2026-09-01 | [FAKTA - source: tidsplan.md, section 5.3] |
```

**CRITICAL RULES:**
- ✅ Extract all milestones with exact dates
- ✅ Note dependencies between milestones
- ✅ Flag tight timelines as risk [ESTIMAT]
- ✅ Check for penalty clauses for missed milestones

## Timeline Calculations

### Working Days vs Calendar Days

**Rule:** Unless specified otherwise, Danish public sector uses working days (arbejdsdage).

**Working days exclude:**
- Weekends (Saturday, Sunday)
- Danish public holidays
- Between Christmas and New Year (often Dec 24 - Jan 1)

**How to mark:**
```markdown
Response time: 10 arbejdsdage [FAKTA - source: SLA.md]
Response time estimate: ~14 calendar days [ESTIMAT - based on 10 working days + weekends]
```

### Lead Time Analysis

**Calculate time available from "now" to submission:**

```markdown
## TIDSPLAN ANALYSE

**Dagens dato**: 2025-10-18 [Reference point]
**Tilbudsfrist**: 2025-11-15 kl. 12:00 [FAKTA - source: udbudsbetingelser.md]
**Tid til forberedelse**: 28 kalenderdage / ~20 arbejdsdage [ESTIMAT]

**Breakdown:**
- Document analysis: 3-5 dage [ESTIMAT]
- Technical analysis: 5-7 dage [ESTIMAT]
- Solution design: 7-10 dage [ESTIMAT]
- Pricing: 3-4 dage [ESTIMAT]
- Review & QA: 2-3 dage [ESTIMAT]
- Buffer: 2-3 dage [ESTIMAT]
**Total estimated**: 22-32 arbejdsdage [ESTIMAT]

**Feasibility**: TIGHT - 28 days available vs 22-32 needed [ESTIMAT]
**Risk**: Medium [ESTIMAT - limited buffer for unexpected issues]
```

### Backward Planning

**Start from submission deadline and work backward:**

```markdown
## INTERN TIDSPLAN (Backward from Deadline)

**Tilbudsfrist**: 2025-11-15 kl. 12:00 [FAKTA]

Working backward:
- **Final submission**: 2025-11-15 09:00 (3h buffer for upload issues) [ESTIMAT]
- **Final QA complete**: 2025-11-13 17:00 (2 days before) [ESTIMAT]
- **Internal approval**: 2025-11-12 17:00 (3 days before) [ESTIMAT]
- **Pricing complete**: 2025-11-11 17:00 (4 days before) [ESTIMAT]
- **Solution design complete**: 2025-11-08 17:00 (7 days before) [ESTIMAT]
- **Technical analysis complete**: 2025-11-04 17:00 (11 days before) [ESTIMAT]
- **Document analysis complete**: 2025-10-28 17:00 (18 days before) [ESTIMAT]
- **START IMMEDIATELY**: 2025-10-18 [If starting today]

**Spørgsmålsfrist**: 2025-10-20 kl. 12:00 [FAKTA]
**Questions must be ready by**: 2025-10-19 17:00 [ESTIMAT - 1 day buffer]
```

## Danish Public Holidays

**Fixed holidays to account for:**
- Nytårsdag (Jan 1)
- Grundlovsdag (Jun 5)
- Juleaften (Dec 24)
- 1. Juledag (Dec 25)
- 2. Juledag (Dec 26)

**Moveable holidays (vary by year):**
- Skærtorsdag (Maundy Thursday)
- Langfredag (Good Friday)
- Påskedag (Easter Sunday)
- 2. Påskedag (Easter Monday)
- Store Bededag (Great Prayer Day - 4th Friday after Easter)
- Kristi Himmelfartsdag (Ascension Day - 39 days after Easter)
- Pinsedag (Whit Sunday - 49 days after Easter)
- 2. Pinsedag (Whit Monday - 50 days after Easter)

**How to mark holiday impact:**
```markdown
**Timeline concern**: Tilbudsfrist er 2025-04-18 (Langfredag) [FAKTA]
**Impact**: Offentlige kontorer lukket - actual deadline likely 2025-04-17 kl. 12:00 [ESTIMAT - må bekræftes]
**Action**: Mark som spørgsmål til udbyder [RECOMMENDATION]
```

## Deadline Conflicts and Risks

### Risk: Tight Timeline

```markdown
**Risk**: Tight submission timeline [ESTIMAT]
**Details**:
- Time available: 20 arbejdsdage [ESTIMAT]
- Time needed (normal pace): 30 arbejdsdage [ESTIMAT]
- Gap: 10 dage shortfall [ESTIMAT]

**Impact**:
- Reduced analysis depth [ESTIMAT]
- Increased error risk [ESTIMAT]
- Resource overcommitment [ESTIMAT]

**Mitigation Options**: [INTERN VURDERING PÅKRÆVET]
```

### Risk: Holiday Period

```markdown
**Risk**: Deadline falls during holiday period [ESTIMAT]
**Details**:
- Tilbudsfrist: 2025-12-30 [FAKTA]
- Period: Between Christmas and New Year [FACT]
- Typical staff availability: 30-50% [ANTAGET - based on industry norm]

**Impact**: Reduced team availability for questions/review [ESTIMAT]
**Mitigation**: Early completion essential [OBSERVATION]
```

### Risk: Question Deadline Already Passed

```markdown
**Risk**: Question deadline has passed [FACT]
**Details**:
- Spørgsmålsfrist: 2025-10-15 kl. 12:00 [FAKTA]
- Dagens dato: 2025-10-18 [REFERENCE]
- Status: 3 dage for sent [FACT]

**Impact**: Cannot get clarification on [LIST] [UKENDT items]
**Decision Impact**: Higher bid risk due to unknowns [ESTIMAT]
```

## Deadline Coordination Pattern

### Multi-Deadline Tracking Table

```markdown
| Deadline Type | Date & Time | Working Days From Now | Status | Kilde |
|---------------|-------------|----------------------|--------|-------|
| Spørgsmålsfrist | 2025-10-20 12:00 | 2 dage | URGENT | [FAKTA - source: X] |
| Clarification responses | 2025-10-27 (forventet) | 9 dage | Expected | [ESTIMAT] |
| Tilbudsfrist | 2025-11-15 12:00 | 28 dage | OK | [FAKTA - source: X] |
| Kontraktstart | 2026-01-01 | - | - | [FAKTA - source: X] |
| Fase 1 milepæl | 2026-03-31 | - | - | [FAKTA - source: X] |
```

### Timeline Visualization

```markdown
## TIDSAKSE

```
2025-10-18          2025-10-20       2025-10-27         2025-11-15
    |                   |                |                   |
  I DAG          SPØRGSMÅLSFRIST    SVAR FORVENTET     TILBUDSFRIST
                [FAKTA]            [ESTIMAT]          [FAKTA]
    |-------------------|----------------|-------------------|
         2 dage              7 dage            19 dage

    <-- Questions Ready -->
                      <-- Analysis Phase -->
                                         <-- Solution + Pricing -->
```
```

## Fact-Checking for Deadlines

Before finalizing timeline analysis:

- [ ] All deadlines extracted from tender with exact source
- [ ] Dates in ISO format (YYYY-MM-DD)
- [ ] Times included if specified (kl. HH:MM)
- [ ] Working days vs calendar days clarified
- [ ] Danish holidays accounted for if in period
- [ ] Backward timeline calculated from submission
- [ ] Timeline feasibility assessed [ESTIMAT]
- [ ] Deadline conflicts identified
- [ ] NO assumptions about flexible deadlines
- [ ] NO extension of deadlines without authority approval

## Common Deadline Patterns

### Pattern 1: Standard Timeline
```
Question deadline: 10-14 days before submission
Clarification responses: 5-7 days before submission
Submission deadline: [Fixed date]
Contract start: 1-3 months after submission
```

### Pattern 2: Fast-Track Timeline
```
Question deadline: 5-7 days before submission
Submission deadline: 3-4 weeks from publication
Contract start: Immediate (within 1 month)
⚠️ High risk due to compressed timeline
```

### Pattern 3: Framework Agreement
```
Submission deadline: [Fixed date]
Contract start: After negotiation (typically 2-4 months)
Call-off periods: Throughout multi-year framework
Milestone deadlines: Per specific call-off
```

## Deadline-Related Questions Template

When unclear, prepare these questions for contracting authority:

```markdown
## SPØRGSMÅL TIL UDBYDER - TIDSPLAN

1. **Tilbudsfrist bekræftelse**
   Spørgsmål: Vi har noteret tilbudsfrist som [DATE] kl. [TIME]. Kan dette bekræftes?
   Grund: [UKENDT - found in multiple places with different times]

2. **Spørgsmålsfrist**
   Spørgsmål: Vi kan ikke finde spørgsmålsfrist i materialet. Hvad er deadline for indsendelse af spørgsmål?
   Grund: [UKENDT - not stated in tender documents]

3. **Helligdag konflikt**
   Spørgsmål: Tilbudsfrist falder på [HOLIDAY]. Skal tilbud indsendes dagen før, eller er systemet åbent på helligdagen?
   Grund: [UKLAR - deadline conflicts with Danish public holiday]

4. **Milepæl feasibility**
   Spørgsmål: Fase 1 skal afsluttes [DATE], kun [X] måneder efter kontraktstart. Er denne tidsplan fleksibel?
   Grund: [ESTIMAT - timeline appears very tight based on scope]
```

## Summary

**Key Takeaways:**
1. Extract ALL deadlines with exact dates, times, and sources
2. Calculate working days accounting for Danish holidays
3. Use backward planning from submission deadline
4. Flag tight timelines and holiday conflicts as risks
5. Mark deadline-related unknowns as [UKENDT] and prepare questions
6. NEVER assume deadline flexibility - treat all as firm unless stated otherwise
