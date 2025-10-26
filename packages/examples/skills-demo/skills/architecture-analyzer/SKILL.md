---
name: architecture-analyzer
description: Software architecture analysis, pattern recognition, and system design evaluation for tender technical assessment
license: MIT
metadata:
  version: "1.0.0"
  author: "Niels Peter"
  tags: "architecture,design,patterns,analysis,system-design,microservices,integration"
---

# Architecture Analyzer

Expert knowledge for analyzing software architectures, identifying patterns, evaluating technical approaches, and assessing system design quality in tender documentation.

## Purpose

This skill provides methodologies and frameworks for:
- Identifying architectural patterns from tender descriptions
- Evaluating architecture quality and maturity
- Analyzing integration architectures
- Assessing scalability and resilience approaches
- Identifying architectural risks and anti-patterns
- Documenting current vs. target architectures

## Critical Rule

**ALL architectural assessments MUST be marked appropriately:**

✅ **Correct:**
```markdown
Architecture pattern: Microservices [FAKTA - described in tender section 3.1]
Scalability approach: Horizontal scaling [ANTAGET - implied by cloud-native requirement]
Integration complexity: High (15+ systems) [ESTIMAT - based on integration list]
```

❌ **Wrong:**
```markdown
The system uses microservices
It scales horizontally
Integration is complex
```

---

## 1. Architecture Pattern Recognition

### Common Patterns

#### Monolithic Architecture

**Characteristics:**
- Single deployable unit
- Shared database
- All modules in one codebase
- Tight coupling between components

**Indicators in Tender:**
- "Single application"
- "Traditional three-tier architecture"
- "One deployment"
- "Shared database"

**Complexity Score:** 1-4/10
**Pros:** Simple deployment, easier development initially
**Cons:** Limited scalability, slow deployment cycles

---

#### Modular Monolith

**Characteristics:**
- Single deployable unit but modular structure
- Clear module boundaries
- Potential for future extraction
- Shared database but modular schema

**Indicators in Tender:**
- "Modular design"
- "Well-structured layers"
- "Clean separation of concerns"
- "Hexagonal architecture" / "Clean architecture"

**Complexity Score:** 3-5/10
**Pros:** Better than pure monolith, maintains simplicity
**Cons:** Still single deployment, limited independent scaling

---

#### Microservices

**Characteristics:**
- Multiple independently deployable services
- Each service owns its data
- Distributed communication (REST, messaging)
- Decentralized governance

**Indicators in Tender:**
- "Microservices architecture"
- "Service-oriented"
- "Independent deployments"
- "API gateway"
- "Event-driven"
- Number of services (5-20+)

**Complexity Score:** 5-9/10
**Pros:** Independent scaling, team autonomy, technology flexibility
**Cons:** Distributed complexity, operational overhead, data consistency challenges

**Sub-patterns:**
- **Standard microservices**: REST APIs, synchronous communication
- **Event-driven microservices**: Message brokers, eventual consistency
- **CQRS/Event Sourcing**: Separate read/write models, event store

---

#### Serverless / FaaS

**Characteristics:**
- Function as a Service (AWS Lambda, Azure Functions)
- Event-triggered execution
- Auto-scaling, pay-per-use
- Managed infrastructure

**Indicators in Tender:**
- "Serverless"
- "AWS Lambda" / "Azure Functions"
- "Event-driven functions"
- "Auto-scaling"

**Complexity Score:** 4-7/10
**Pros:** Cost-efficient, auto-scaling, reduced ops
**Cons:** Vendor lock-in, cold starts, debugging complexity

---

## 2. Architecture Quality Assessment

### Scalability Analysis

**Horizontal Scaling (Scale-out):**
- **Indicators:** Load balancer, stateless services, distributed cache
- **Assessment:** Can add more instances? [ESTIMAT - based on architecture]
- **Limitations:** Stateful components, session management, database bottlenecks

**Vertical Scaling (Scale-up):**
- **Indicators:** Single instance, increased resources
- **Assessment:** Upper limits? [ESTIMAT]
- **Limitations:** Hardware constraints, cost, single point of failure

**Database Scaling:**
- **Read replicas:** Horizontal read scaling
- **Sharding:** Horizontal write scaling (high complexity)
- **Caching:** Redis/Memcached for performance
- **CQRS:** Separate read/write databases

**Scalability Score Formula:**
```
Scalability Score = (Horizontal Capability * 0.5) + (Database Strategy * 0.3) +
                     (Stateless Design * 0.2)
```

| Score | Assessment |
|-------|------------|
| 1-3 | Limited - Vertical only, stateful, single DB |
| 4-6 | Moderate - Some horizontal, caching, read replicas |
| 7-8 | Good - Full horizontal, distributed cache, CQRS optional |
| 9-10 | Excellent - Auto-scaling, multi-region, advanced patterns |

---

### Resilience & Fault Tolerance

**Resilience Patterns to Look For:**

1. **Circuit Breaker**
   - Prevents cascading failures
   - Indicators: "Circuit breaker", "Hystrix", "Resilience4j"

2. **Retry with Backoff**
   - Handles transient failures
   - Indicators: "Retry logic", "exponential backoff"

3. **Bulkhead Pattern**
   - Isolates resources
   - Indicators: "Thread pools", "resource isolation"

4. **Health Checks**
   - Service monitoring
   - Indicators: "Health endpoints", "readiness/liveness probes"

5. **Graceful Degradation**
   - Reduced functionality under load
   - Indicators: "Fallback", "degraded mode"

**Resilience Assessment:**

| Pattern Present | Points |
|----------------|--------|
| Circuit Breaker | +2 |
| Retry Logic | +1 |
| Health Checks | +1 |
| Bulkhead | +2 |
| Graceful Degradation | +2 |
| Load Shedding | +2 |

**Score:** Sum points, max 10

---

### Data Architecture Patterns

#### Database per Service (Microservices)

**Characteristics:**
- Each service owns its database
- No direct database sharing
- Data duplication accepted

**Pros:** Service independence, technology diversity
**Cons:** Data consistency complexity, no ACID across services

**Indicators in Tender:**
- "Database per service"
- "Polyglot persistence"
- "Eventual consistency"

---

#### Shared Database

**Characteristics:**
- Multiple services/modules share database
- Tight coupling through schema
- ACID transactions

**Pros:** Simple, strong consistency
**Cons:** Coupling, scaling bottleneck, schema conflicts

**Indicators in Tender:**
- "Shared database"
- "Single database instance"
- No mention of distributed data

---

#### CQRS (Command Query Responsibility Segregation)

**Characteristics:**
- Separate read and write models
- Write optimized for consistency
- Read optimized for performance

**Pros:** Read/write optimization, scalability
**Cons:** Complexity, eventual consistency

**Indicators in Tender:**
- "CQRS"
- "Separate read/write databases"
- "Event sourcing"
- "Materialized views"

---

#### Event Sourcing

**Characteristics:**
- Events as source of truth
- State derived from event log
- Append-only event store

**Pros:** Full audit trail, temporal queries, event replay
**Cons:** High complexity, eventual consistency, storage growth

**Indicators in Tender:**
- "Event sourcing"
- "Event store"
- "Event log"
- "Kafka as source of truth"

---

## 3. Integration Architecture Analysis

### Integration Patterns

#### API Gateway Pattern

**Purpose:** Single entry point for clients

**Characteristics:**
- Request routing
- Authentication/authorization
- Rate limiting
- Protocol translation
- Response aggregation

**Indicators:** "API Gateway", "Kong", "Apigee", "AWS API Gateway"

**Complexity:** Medium (Score: 5-6/10)

---

#### Backend for Frontend (BFF)

**Purpose:** Dedicated backend per frontend type

**Characteristics:**
- Mobile BFF, Web BFF, etc.
- Client-specific optimization
- Reduces over-fetching

**Indicators:** "BFF pattern", "Mobile API", "Web API"

**Complexity:** Medium-High (Score: 6-7/10)

---

#### Service Mesh

**Purpose:** Infrastructure layer for service-to-service communication

**Characteristics:**
- Istio, Linkerd
- Traffic management
- Security (mTLS)
- Observability

**Indicators:** "Service mesh", "Istio", "Linkerd", "Envoy"

**Complexity:** High (Score: 8-9/10)

---

#### Message Broker / Event Bus

**Purpose:** Asynchronous communication

**Characteristics:**
- RabbitMQ, Kafka, AWS SQS/SNS
- Pub/Sub or Queue patterns
- Decoupled services

**Indicators:** "Message queue", "Event bus", "Kafka", "RabbitMQ", "Pub/Sub"

**Complexity:** Medium-High (Score: 6-8/10)

---

### Integration Complexity Matrix

| Integration Type | Complexity | Typical Hours | Risk Level |
|-----------------|------------|---------------|------------|
| REST API (modern) | Low (3/10) | 20-30h | Low |
| REST API (legacy) | Medium (5/10) | 40-60h | Medium |
| GraphQL | Medium (5/10) | 30-50h | Medium |
| SOAP/XML | High (7/10) | 50-80h | High |
| Message Queue | Medium-High (6/10) | 40-60h | Medium |
| Event Streaming (Kafka) | High (7/10) | 60-100h | High |
| Database-to-Database | High (8/10) | 60-100h | High |
| File-based (FTP/SFTP) | Medium (5/10) | 30-50h | Medium |
| Custom Protocol | Very High (9/10) | 80-150h | Very High |

---

## 4. Cloud Architecture Patterns

### Cloud-Native Patterns

#### 12-Factor App Principles

Look for indicators of 12-factor compliance:

1. **Codebase:** One codebase, many deploys
2. **Dependencies:** Explicit dependency declaration
3. **Config:** Configuration in environment
4. **Backing Services:** Treat as attached resources
5. **Build/Release/Run:** Strict separation
6. **Processes:** Stateless processes
7. **Port Binding:** Self-contained services
8. **Concurrency:** Scale via process model
9. **Disposability:** Fast startup/graceful shutdown
10. **Dev/Prod Parity:** Keep environments similar
11. **Logs:** Treat as event streams
12. **Admin Processes:** Run as one-off processes

**Assessment:** Count how many are mentioned [ESTIMAT]

---

#### Container Orchestration

**Kubernetes Indicators:**
- "Kubernetes", "K8s"
- "Container orchestration"
- "Pods", "Deployments"
- "Helm charts"

**Complexity:** High (7-8/10)

**Docker (without orchestration):**
- "Docker containers"
- "Docker Compose"

**Complexity:** Medium (5-6/10)

---

#### Infrastructure as Code (IaC)

**Indicators:**
- "Terraform"
- "CloudFormation"
- "ARM templates"
- "Infrastructure as Code"
- "GitOps"

**Complexity:** Medium (5-6/10)

---

## 5. Architectural Risk Assessment

### Common Anti-Patterns

#### Distributed Monolith

**Signs:**
- Microservices with tight coupling
- Synchronized deployments required
- Shared database between services
- Brittle integration

**Risk Level:** Critical
**Impact:** Loss of microservices benefits, added complexity

---

#### God Service / Mega Service

**Signs:**
- One service much larger than others
- Many responsibilities in single service
- Bottleneck for changes

**Risk Level:** High
**Impact:** Scaling issues, deployment bottleneck

---

#### Chatty Services

**Signs:**
- Many small synchronous calls between services
- N+1 query problem across services
- Performance degradation

**Risk Level:** High
**Impact:** Latency, cascading failures

---

#### Lack of API Versioning

**Signs:**
- No version in API endpoints
- Breaking changes expected
- No backward compatibility strategy

**Risk Level:** High
**Impact:** Breaking changes, integration failures

---

### Risk Scoring Formula

```
Architecture Risk Score = (Anti-patterns * 3) + (Technology Immaturity * 2) +
                          (Integration Complexity) + (Missing Resilience Patterns)
```

| Risk Score | Assessment | Action |
|------------|------------|--------|
| 0-5 | Low Risk | Standard development |
| 6-10 | Medium Risk | Add contingency (15-20%) |
| 11-15 | High Risk | Add contingency (25-30%), mitigation plan |
| 16+ | Critical Risk | Significant risk, consider alternatives |

---

## 6. Documentation Template

### Architecture Analysis Output

Use this template for architecture analysis in tender documents:

```markdown
## SYSTEM ARKITEKTUR ANALYSE

### Nuværende Arkitektur
**Mønster:** [Pattern name] [FAKTA/ANTAGET - based on tender section X]
**Kompleksitet:** [Score/10] [ESTIMAT]
**Skalerbarhed:** [Assessment] [ESTIMAT]

**Komponenter:**
| Komponent | Teknologi | Rolle | Kilde |
|-----------|-----------|-------|-------|
| [Component] | [Tech] | [Purpose] | [FAKTA - doc ref] |

### Target Arkitektur (fra Udbud)
**Påkrævet Mønster:** [Pattern] [FAKTA - tender requirement]
**Skalerbarhed Krav:** [Requirements] [FAKTA]
**Resiliens Krav:** [Requirements] [FAKTA]

### Integration Arkitektur
**Antal Integrationer:** [Number] [FAKTA]
**Primære Protokoller:** [List] [FAKTA]
**Kompleksitet Score:** [Score/10] [ESTIMAT - based on integration matrix]

### Identificerede Mønstre
| Mønster | Tilstede? | Kompleksitet | Kilde |
|---------|-----------|--------------|-------|
| [Pattern] | Ja/Nej | [Score] | [FAKTA/ESTIMAT] |

### Arkitektur Risici
| Risiko | Sandsynlighed | Impact | Mitigering |
|--------|---------------|--------|------------|
| [Risk] | [H/M/L] [ESTIMAT] | [H/M/L] | [Strategy] |

### Teknisk Gæld / Anti-patterns
[List any identified anti-patterns] [ESTIMAT]

### Påkrævede Arkitektur Kompetencer (fra Udbud)
[List competencies required by tender] [FAKTA]

**Vurdering af intern kapacitet:** [INTERN VURDERING PÅKRÆVET]
```

---

## Usage Guidelines

### When Analyzing Architecture

1. **Read tender thoroughly** - Use tool calls to read all architecture sections
2. **Identify explicit patterns** - Mark what's stated directly [FAKTA]
3. **Infer reasonable patterns** - Mark implied patterns [ANTAGET]
4. **Calculate complexity** - Use scoring formulas [ESTIMAT]
5. **Identify risks** - List anti-patterns and risks [ESTIMAT]
6. **Never assess bidder capability** - Mark as [INTERN VURDERING PÅKRÆVET]

### What to Mark as [FAKTA]

- Architectural patterns explicitly stated in tender
- Technology requirements from tender
- Number of integrations listed in tender
- Performance requirements from tender
- Scalability requirements from tender

### What to Mark as [ESTIMAT]

- Complexity scores calculated from tender info
- Risk assessments based on architecture
- Effort estimates for architecture implementation
- Scalability assessments
- Integration complexity scores

### What to Mark as [ANTAGET]

- Implied patterns not explicitly stated
- Industry-standard approaches when not specified
- Reasonable architectural assumptions

### What to Mark as [INTERN VURDERING PÅKRÆVET]

- Whether bidder has architecture expertise
- Whether bidder can implement the architecture
- Whether team has relevant architecture experience
- Whether timeline is feasible for bidder's team

---

## Important Notes

1. **Focus on WHAT, not WHO** - Describe architecture requirements, not bidder's ability to deliver
2. **Be specific** - Don't just say "microservices", specify count, patterns, complexity
3. **Show your work** - Include calculation methodology in [ESTIMAT] markers
4. **Source everything** - Reference specific tender sections for [FAKTA] claims
5. **Identify gaps** - Mark missing architecture info as [UKENDT]
6. **Assess risks objectively** - Based on architecture, not bidder's capability

For detailed pattern examples and extended analysis methodologies, see reference files in this skill directory.
