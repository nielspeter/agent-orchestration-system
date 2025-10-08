#!/usr/bin/env python3
"""
name: validate_bank_account
description: Validate bank account details for payment processing
parameters:
  account_number: string
  account_name: string
"""

import json
import sys
from datetime import datetime


def validate_bank_account(account_number, account_name):
    """
    Mock bank account validation.
    
    Args:
        account_number: Bank account number
        account_name: Account holder name
    
    Returns:
        Dictionary with validation result
    """
    # Simple mock validation - accepts all valid-looking account numbers
    is_valid = len(account_number) >= 8 and len(account_name) > 0
    
    return {
        "valid": is_valid,
        "accountStatus": "active" if is_valid else "invalid",
        "accountName": account_name,
        "bankName": "Mock National Bank",
        "accountType": "Checking",
        "verificationTimestamp": datetime.now().isoformat() + 'Z'
    }

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        account_number = input_data.get('account_number', '')
        account_name = input_data.get('account_name', '')
        
        if not account_number or not account_name:
            raise ValueError("Both account number and account name are required")
        
        # Validate bank account
        result = validate_bank_account(account_number, account_name)
        
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