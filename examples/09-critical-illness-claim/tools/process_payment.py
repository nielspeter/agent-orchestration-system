#!/usr/bin/env python3
"""
name: process_payment
description: Process payment for approved insurance claims
parameters:
  claim_id: string
  amount: number
  account_name: string
  account_number: string
  bank_name: string
"""

import json
import sys
from datetime import datetime, timedelta


def process_payment(claim_id, amount, bank_details):
    """
    Mock payment processing service.
    
    Args:
        claim_id: The claim ID
        amount: Payment amount
        bank_details: Dictionary with account details
    
    Returns:
        Dictionary with payment status and reference
    """
    # Check for payment failure triggers
    if (bank_details.get("triggerFailure") == True or 
        bank_details.get("accountNumber") == "INVALID" or
        bank_details.get("bankName") == "Failed Transaction Bank"):
        # Simulate payment failure
        return {
            "status": "failed",
            "errorCode": "PAYMENT_FAILED",
            "errorMessage": "Payment could not be processed - Invalid account details",
            "attemptedAmount": amount,
            "currency": "USD",
            "processingTime": datetime.now().isoformat() + 'Z',
            "bankDetails": {
                "accountName": bank_details.get("accountName"),
                "accountNumber": "****INVALID",
                "bankName": bank_details.get("bankName")
            },
            "retryAvailable": True,
            "failureReason": "Bank account validation failed"
        }
    
    # Normal successful payment processing
    payment_ref = f"PAY-{claim_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return {
        "status": "success",
        "paymentReference": payment_ref,
        "processedAmount": amount,
        "currency": "USD",
        "processingTime": "2025-01-13T10:30:00Z",
        "expectedCreditDate": (datetime.now() + timedelta(days=3)).isoformat() + 'Z',
        "bankDetails": {
            "accountName": bank_details.get("accountName"),
            "accountNumber": f"****{bank_details.get('accountNumber', '0000')[-4:]}",
            "bankName": bank_details.get("bankName")
        }
    }

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        claim_id = input_data.get('claim_id', '')
        amount = input_data.get('amount', 0)
        
        # Build bank details from individual parameters
        bank_details = {
            'accountName': input_data.get('account_name', ''),
            'accountNumber': input_data.get('account_number', ''),
            'bankName': input_data.get('bank_name', '')
        }
        
        # Check for trigger failure flag
        if input_data.get('trigger_failure'):
            bank_details['triggerFailure'] = True
        
        # Process the payment
        result = process_payment(claim_id, amount, bank_details)
        
        # Add success flag for consistency
        result['success'] = result['status'] == 'success'
        
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