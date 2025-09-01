# Claim ID Generator

## Purpose
Generates deterministic, unique claim IDs for insurance claims processing

## Language
python

## When to Use
ALWAYS use this tool when registering a new claim to ensure consistent ID generation

## How to Use
```python
from claim_id_generator import generate_claim_id

claim_id = generate_claim_id(
    policy_number="POL-12345",
    timestamp="2025-01-13T10:30:00Z",
    claim_type="CI"  # Critical Illness
)
# Returns: "CI-20250113-7D4FE"
```

## Output
String in format: `CI-YYYYMMDD-XXXXX`
- CI: Claim type prefix
- YYYYMMDD: Date from timestamp
- XXXXX: Unique hash suffix based on policy and timestamp