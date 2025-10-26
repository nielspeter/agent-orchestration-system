---
name: complexity-calculator
description: Software development complexity assessment and effort estimation formulas for tender analysis
license: MIT
metadata:
  version: "1.0.0"
  author: "Niels Peter"
  tags: "estimation,complexity,effort,calculation,software-development"
---

# Complexity Calculator

Domain expertise for calculating software development complexity and estimating effort for tender analysis.

## Purpose

This skill provides standardized formulas, reference tables, and methodologies for:
- Calculating technical complexity scores (1-10 scale)
- Estimating development effort in hours
- Assessing integration complexity
- Evaluating data migration complexity
- Determining technology maturity impact
- Applying industry-standard multipliers

## Critical Rule

**ALL estimates MUST be marked [ESTIMAT] and include methodology:**

✅ **Correct:**
```markdown
Development effort: 800 hours [ESTIMAT - 5 microservices * 160h average]
Integration complexity: 7/10 [ESTIMAT - 15 external systems + 2 legacy SOAP]
```

❌ **Wrong:**
```markdown
Development effort: 800 hours
Integration complexity: High
```

---

## 1. Complexity Scoring System (1-10 Scale)

### Overall Complexity Score

**Formula:**
```
Overall Complexity = (Architecture * 0.25) + (Integration * 0.30) +
                     (Technology * 0.20) + (Data * 0.15) + (Security * 0.10)
```

**Scoring Guide:**
- **1-3**: Low complexity - Standard patterns, mature tech, minimal integration
- **4-6**: Medium complexity - Some custom work, moderate integrations, established tech
- **7-8**: High complexity - Significant custom development, many integrations, newer tech
- **9-10**: Very high complexity - Novel architecture, extensive integrations, bleeding-edge tech

### Architecture Complexity

| Score | Description | Examples |
|-------|-------------|----------|
| 1-2 | Simple monolith | Single application, simple database, minimal components |
| 3-4 | Modular monolith | Well-structured layers, multiple modules, standard patterns |
| 5-6 | Microservices (standard) | 3-8 services, event bus, API gateway, standard patterns |
| 7-8 | Complex microservices | 9-15 services, CQRS/ES, multiple data stores, service mesh |
| 9-10 | Highly distributed | 15+ services, complex orchestration, multiple patterns, novel architecture |

### Integration Complexity

**Base Formula:**
```
Integration Score = min(10, (Number of Systems * 0.5) + Protocol Complexity + Auth Complexity)
```

**Protocol Complexity:**
- REST API (modern): +0 points
- REST API (legacy/poorly documented): +1 point
- SOAP/XML: +2 points
- File-based (CSV/XML/JSON): +1 point
- Database-to-database: +2 points
- Message queue (RabbitMQ/Kafka): +1 point
- Custom protocol: +3 points

**Auth Complexity:**
- OAuth2/OpenID Connect (standard): +0 points
- Basic Auth/API Key: +0.5 points
- Custom auth: +1 point
- Multiple auth methods: +1 point
- Unknown auth: +2 points (mark as [UKENDT])

**Integration Scoring Guide:**
| Score | Number of Systems | Typical Scenario |
|-------|-------------------|------------------|
| 1-2 | 1-2 systems | Single REST API integration |
| 3-4 | 3-5 systems | Multiple REST APIs, standard patterns |
| 5-6 | 6-10 systems | Mix of REST/SOAP, some legacy |
| 7-8 | 11-15 systems | Many integrations, some complex protocols |
| 9-10 | 15+ systems | Extensive integration landscape, complex protocols |

### Technology Stack Complexity

**Maturity Assessment:**
| Maturity Level | Points | Description |
|----------------|--------|-------------|
| Mature | +0 | 5+ years, widespread adoption, stable ecosystem |
| Established | +1 | 2-5 years, growing adoption, maturing ecosystem |
| Emerging | +2 | 1-2 years, early adoption, evolving ecosystem |
| Bleeding-edge | +3 | less than 1 year, experimental, limited production use |

**Technology Stack Score Formula:**
```
Tech Score = (Backend Maturity + Frontend Maturity + Database Maturity +
              Infrastructure Maturity + Learning Curve) / 5
```

**Learning Curve Modifier:**
- Standard/common tech stack: +0 points
- Specialized but documented: +1 point
- Niche or poorly documented: +2 points
- Novel/experimental: +3 points

### Data Migration Complexity

**Base Formula:**
```
Data Score = Volume Score + Quality Score + Transformation Score + Downtime Score
```

**Volume Scoring:**
| Records | Score |
|---------|-------|
| less than 100K | 1 |
| 100K - 1M | 2 |
| 1M - 10M | 3 |
| 10M - 100M | 4 |
| 100M+ | 5 |

**Quality Scoring:**
- Clean, validated data: +0 points
- Minor data quality issues: +1 point
- Moderate issues (some cleanup needed): +2 points
- Poor quality (extensive cleanup): +3 points
- Unknown quality: +2 points (mark as [UKENDT])

**Transformation Complexity:**
- Direct mapping (same structure): +0 points
- Simple transformations (field mapping): +1 point
- Complex transformations (business logic): +2 points
- Data enrichment required: +2 points

**Downtime Tolerance:**
- Days of downtime allowed: +0 points
- Hours of downtime allowed: +1 point
- Minimal downtime (less than 1 hour): +2 points
- Zero downtime required: +3 points

### Security/Compliance Complexity

| Score | Description | Examples |
|-------|-------------|----------|
| 1-2 | Basic security | HTTPS, standard auth, basic logging |
| 3-4 | Standard compliance | GDPR basic, role-based access, audit logs |
| 5-6 | Regulated industry | Financial sector, healthcare, enhanced logging, encryption |
| 7-8 | High security | Government, defense, end-to-end encryption, advanced threat detection |
| 9-10 | Critical security | National security, multi-layered security, extensive auditing |

---

## 2. Effort Estimation Formulas

### Component-Based Estimation

**Backend Development:**
```
Backend Hours = (REST Endpoints * Endpoint Factor) + (Business Logic * Logic Factor) +
                (Data Layer * Data Factor)
```

**Standard Factors:**
- Simple REST endpoint (CRUD): 8-12 hours
- Medium REST endpoint (with business logic): 16-24 hours
- Complex REST endpoint (complex logic, multiple integrations): 32-48 hours
- Business logic module: 24-40 hours
- Data layer (per entity): 4-8 hours

**Frontend Development:**
```
Frontend Hours = (Views * View Factor) + (Components * Component Factor) +
                 (State Management * State Factor)
```

**Standard Factors:**
- Simple view (display only): 8-12 hours
- Medium view (forms, basic interaction): 16-24 hours
- Complex view (complex interaction, real-time updates): 32-48 hours
- Reusable component: 4-8 hours
- Complex component (charts, tables, etc.): 12-20 hours
- State management setup: 16-24 hours

### Integration Effort Estimation

**Per Integration:**
```
Integration Hours = Base Hours + Protocol Factor + Auth Factor + Complexity Factor
```

**Base Hours by Type:**
- REST API (well-documented): 20-30 hours
- REST API (poor/no docs): 40-60 hours
- SOAP/XML service: 40-60 hours
- Legacy system (file-based): 30-50 hours
- Database-to-database: 40-60 hours
- Message queue integration: 30-40 hours
- Custom protocol: 60-100 hours

**Complexity Multipliers:**
- Unknown/unclear specs: 1.5x
- Real-time requirements: 1.3x
- Bi-directional sync: 1.4x
- Data transformation needed: 1.2x
- Error handling critical: 1.2x

### Data Migration Effort

**Migration Hours Formula:**
```
Migration Hours = (Planning + Development + Testing + Execution) * Complexity Multiplier
```

**Base Hours by Volume:**
| Records | Planning | Development | Testing | Execution |
|---------|----------|-------------|---------|-----------|
| less than 100K | 8h | 40h | 24h | 8h |
| 100K-1M | 16h | 80h | 40h | 16h |
| 1M-10M | 24h | 120h | 60h | 24h |
| 10M-100M | 40h | 200h | 100h | 40h |
| 100M+ | 60h | 300h | 150h | 60h |

**Complexity Multipliers:**
- Clean data, direct mapping: 1.0x
- Minor transformations: 1.2x
- Complex transformations: 1.5x
- Poor data quality: 1.8x
- Zero downtime requirement: 2.0x

### Testing Effort

**Standard Testing Ratios:**
```
Unit Testing = Development Hours * 0.15-0.25
Integration Testing = Development Hours * 0.10-0.15
E2E Testing = Critical Paths * 4-8 hours per path
Performance Testing = 40-80 hours (if required)
Security Testing = 40-120 hours (depending on requirements)
UAT Support = 2-4 weeks * 20-40 hours/week
```

### Documentation Effort

**Documentation Hours:**
- Technical architecture document: 16-24 hours
- API documentation (per 10 endpoints): 8-12 hours
- User guide (per 10 pages): 12-20 hours
- Admin guide: 16-24 hours
- Deployment guide: 8-16 hours
- Code comments: 5-10% of development time

### DevOps/Infrastructure

**Setup Hours:**
- CI/CD pipeline (basic): 24-40 hours
- CI/CD pipeline (advanced): 60-100 hours
- Container setup (Docker): 16-24 hours
- Orchestration (Kubernetes): 40-60 hours
- Monitoring/logging setup: 24-40 hours
- Security scanning integration: 16-24 hours

---

## 3. Industry Standard Multipliers

### Project Management Overhead

| Project Size (Hours) | PM Overhead |
|---------------------|-------------|
| less than 500 | 8-10% |
| 500-2000 | 10-12% |
| 2000-5000 | 12-15% |
| 5000+ | 15-20% |

### Contingency/Buffer

| Complexity Score | Contingency |
|-----------------|-------------|
| 1-3 (Low) | 10-15% |
| 4-6 (Medium) | 15-20% |
| 7-8 (High) | 20-30% |
| 9-10 (Very High) | 30-40% |

### Team Experience Factor

**Apply to all estimates if team experience is known:**
- Expert team (5+ years in stack): 0.8x (20% faster)
- Experienced team (2-5 years): 1.0x (baseline)
- Mixed experience team: 1.2x (20% slower)
- Junior team (less than 2 years): 1.5x (50% slower)

**IMPORTANT:** Team experience is [INTERN VURDERING PÅKRÆVET] - DO NOT assume bidder's experience level.

### Technology Familiarity Factor

**If technology requirements from tender are unusual:**
- Familiar technology (common stack): 1.0x
- Partially familiar (some new tech): 1.2x
- Mostly unfamiliar (significant new tech): 1.5x
- Completely unfamiliar (all new): 2.0x

**IMPORTANT:** Technology familiarity is [INTERN VURDERING PÅKRÆVET] - base estimates on industry averages, note that actual hours depend on bidder's familiarity.

---

## 4. FTE Calculation

### Standard Working Hours

**Annual hours calculation:**
```
Work Hours per Year = 52 weeks * 5 days * 8 hours = 2080 hours
Minus holidays/vacation: ~80-160 hours
Effective hours per year: 1920-2000 hours
```

**Standard assumption for Denmark:** 2000 effective hours/year per FTE

**FTE Formula:**
```
FTE Required = Total Hours / 2000
```

### Project Duration to FTE

**Duration-based calculation:**
```
FTE = Total Hours / (Duration in Months * 160)
```
*(160 hours = 20 days * 8 hours per month average)*

**Example:**
- Total: 3200 hours
- Duration: 6 months
- FTE = 3200 / (6 * 160) = 3200 / 960 = 3.33 FTE

### Minimum Viable Team

**Standard roles for typical project:**
- Backend Developer: 1-2 FTE
- Frontend Developer: 1-2 FTE
- Full-stack Developer (alternative): 1-3 FTE
- Architect: 0.2-0.5 FTE (part-time)
- DevOps: 0.3-0.5 FTE (part-time)
- Tester: 0.3-0.5 FTE (part-time or continuous)
- Project Manager: 0.2-0.3 FTE (part-time)

**Total typical team:** 3-5 FTE for medium project

---

## Usage Guidelines

### When Estimating

1. **Start with requirements** - Extract technical scope from tender [FAKTA]
2. **Calculate complexity** - Use scoring system to assess complexity [ESTIMAT]
3. **Estimate components** - Use formulas for each component [ESTIMAT]
4. **Apply multipliers** - Add overhead, contingency, experience factors [ESTIMAT]
5. **Sanity check** - Validate against industry norms [ESTIMAT]
6. **Show methodology** - Always explain your calculation [ESTIMAT - based on X]

### What to Mark as [INTERN VURDERING PÅKRÆVET]

- Team experience level (affects multipliers)
- Technology familiarity (affects multipliers)
- Team availability (for timeline feasibility)
- Whether timeline is achievable (depends on team capacity)

### What to Mark as [ESTIMAT]

- ALL complexity scores
- ALL hour estimates
- ALL effort calculations
- ALL FTE conversions
- ALL timeline assessments based on estimates

### What to Mark as [FAKTA]

- Technical requirements from tender
- Number of integrations stated in tender
- Required technologies from tender
- Timeline/deadlines from tender
- Team size requirements from tender (if stated)

---

## Important Notes

1. **These are industry averages** - Actual effort depends on team experience, technology familiarity, and specific requirements
2. **Always show your work** - Include calculation methodology in [ESTIMAT] marker
3. **Use conservative estimates** - When uncertain, prefer higher estimates (reduces risk)
4. **Adjust for unknowns** - Add contingency for [UKENDT] items
5. **Separate facts from estimates** - Requirements are [FAKTA], effort calculations are [ESTIMAT]
6. **Team assessment is internal** - Never assume bidder's capabilities, mark as [INTERN VURDERING PÅKRÆVET]

For detailed examples and extended methodologies, see reference files in this skill directory.
