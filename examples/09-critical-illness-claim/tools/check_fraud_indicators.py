#!/usr/bin/env python3
"""
name: check_fraud_indicators
description: Check for fraud indicators in insurance claims
parameters:
  claim_id: string
  policy_number: string
  amount: number
"""

import sys
import json
from datetime import datetime

def check_fraud_indicators(claim_id, policy_number, amount):
    """
    Mock fraud detection service.
    
    Args:
        claim_id: The claim ID
        policy_number: Policy number
        amount: Claim amount
    
    Returns:
        Dictionary with fraud risk assessment
    """
    # Mock fraud check - always returns low risk for testing
    return {
        "claimId": claim_id,
        "fraudRisk": "low",
        "riskScore": 0.15,  # 0-1 scale
        "flags": [],
        "requiresInvestigation": False,
        "assessmentTimestamp": datetime.now().isoformat() + 'Z'
    }

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        claim_id = input_data.get('claim_id', '')
        policy_number = input_data.get('policy_number', '')
        amount = input_data.get('amount', 0)
        
        if not claim_id or not policy_number:
            raise ValueError("Claim ID and policy number are required")
        
        # Check fraud indicators
        result = check_fraud_indicators(claim_id, policy_number, amount)
        
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