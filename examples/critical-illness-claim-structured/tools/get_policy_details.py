#!/usr/bin/env python3
"""
name: get_policy_details
description: Retrieve insurance policy details from database
parameters:
  policy_number: string
"""

import json
import sys
from datetime import datetime, timedelta


def get_policy_details(policy_number):
    """
    Mock policy database lookup.
    
    Args:
        policy_number: The policy number to look up
    
    Returns:
        Dictionary with policy details
    """
    # Generate consistent mock data based on policy number
    policy_seed = int(policy_number.split('-')[1]) if '-' in policy_number else 12345
    
    base_coverage = 100000 + (policy_seed * 1000)
    
    # Special case for testing waiting period rejection
    if policy_number == "POL-99999":
        # Michael Brown's policy - started only 30 days ago
        start_date = datetime.now() - timedelta(days=30)
    else:
        # Default calculation for other policies
        start_date = datetime.now() - timedelta(days=365 + (policy_seed % 365))
    
    return {
        "policyNumber": policy_number,
        "type": "Critical Illness Premium",
        "status": "active",
        "sumAssured": base_coverage,
        "coverageStartDate": start_date.isoformat() + 'Z',
        "premiumStatus": "paid",
        "premiumAmount": base_coverage * 0.002,  # 0.2% of sum assured
        "paymentFrequency": "monthly",
        "coveredConditions": [
            "Cancer", "Heart Attack", "Stroke", "Kidney Failure",
            "Major Organ Transplant", "Paralysis", "Multiple Sclerosis",
            "Parkinson's Disease", "Alzheimer's Disease", "Coma"
        ],
        "exclusions": [
            "Pre-existing conditions",
            "Self-inflicted injuries",
            "Drug/alcohol related",
            "War injuries"
        ],
        "waitingPeriod": 90,
        "remainingCoverage": base_coverage,
        "previousClaims": [],
        "beneficiaries": [
            {
                "name": "Primary Beneficiary",
                "relationship": "Spouse",
                "percentage": 100
            }
        ]
    }

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        policy_number = input_data.get('policy_number', '')
        
        if not policy_number:
            raise ValueError("Policy number is required")
        
        # Get policy details
        result = get_policy_details(policy_number)
        
        # Add success flag
        result['success'] = True
        
        print(json.dumps(result))
        return 0
        
    except Exception as e:
        # Return error response as JSON
        error = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error))
        return 1

if __name__ == "__main__":
    sys.exit(main())