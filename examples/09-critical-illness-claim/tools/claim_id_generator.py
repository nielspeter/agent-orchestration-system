#!/usr/bin/env python3
"""
name: claim_id_generator
description: Generate deterministic claim IDs for insurance claims
parameters:
  policy_number: string
  timestamp: string
  claim_type: string
"""

import sys
import json
import hashlib
from datetime import datetime

def generate_claim_id(policy_number, timestamp, claim_type="CI"):
    """
    Generate a unique claim ID.
    
    Args:
        policy_number: The policy number (e.g., "POL-12345")
        timestamp: ISO format timestamp string
        claim_type: Type of claim (default "CI" for Critical Illness)
    
    Returns:
        String claim ID in format: CI-YYYYMMDD-XXXXX
    """
    # Extract date from timestamp
    date_str = timestamp.split('T')[0].replace('-', '')
    
    # Create hash from policy number and timestamp for uniqueness
    hash_input = f"{policy_number}-{timestamp}"
    hash_obj = hashlib.sha256(hash_input.encode())
    hash_hex = hash_obj.hexdigest()
    
    # Take first 5 characters of hash for ID suffix
    hash_suffix = hash_hex[:5].upper()
    
    # Format: CI-YYYYMMDD-XXXXX
    claim_id = f"{claim_type}-{date_str}-{hash_suffix}"
    
    return claim_id

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        policy_number = input_data.get('policy_number', '')
        timestamp = input_data.get('timestamp', datetime.now().isoformat())
        claim_type = input_data.get('claim_type', 'CI')
        
        # Generate the claim ID
        claim_id = generate_claim_id(policy_number, timestamp, claim_type)
        
        # Return success response as JSON
        result = {
            'success': True,
            'claim_id': claim_id,
            'policy_number': policy_number,
            'timestamp': timestamp,
            'claim_type': claim_type
        }
        
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