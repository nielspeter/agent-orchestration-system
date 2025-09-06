#!/usr/bin/env python3
"""
name: send_notification
description: Send notifications to claimants via email or phone
parameters:
  recipient_email: string
  recipient_phone: string
  message_type: string
  content: string
"""

import json
import sys
from datetime import datetime


def send_notification(recipient, message_type, content):
    """
    Mock notification service.
    
    Args:
        recipient: Dictionary with contact details
        message_type: Type of notification
        content: Message content
    
    Returns:
        Dictionary with delivery status
    """
    notification_id = f"NOTIF-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return {
        "notificationId": notification_id,
        "recipient": recipient.get("email", recipient.get("phone")),
        "messageType": message_type,
        "deliveryStatus": "delivered",
        "sentAt": datetime.now().isoformat() + 'Z',
        "readReceipt": False
    }

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        recipient = {}
        if input_data.get('recipient_email'):
            recipient['email'] = input_data['recipient_email']
        if input_data.get('recipient_phone'):
            recipient['phone'] = input_data['recipient_phone']
            
        message_type = input_data.get('message_type', 'general')
        content = input_data.get('content', '')
        
        # Send the notification
        result = send_notification(recipient, message_type, content)
        
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