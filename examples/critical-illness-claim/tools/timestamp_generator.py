#!/usr/bin/env python3
"""
name: timestamp_generator
description: Generate and format timestamps in ISO 8601 format
parameters:
  operation: string
  timestamp: string
  date1: string
  date2: string
"""

import json
import sys
from datetime import datetime, timezone


def generate_timestamp():
    """
    Generate current timestamp in ISO 8601 format.
    
    Returns:
        String timestamp in ISO format: YYYY-MM-DDTHH:MM:SSZ
    """
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def format_timestamp(timestamp_str):
    """
    Ensure timestamp is in consistent ISO format.
    
    Args:
        timestamp_str: Timestamp string in various formats
    
    Returns:
        String timestamp in ISO format: YYYY-MM-DDTHH:MM:SSZ
    """
    # Parse various timestamp formats
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d"
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(timestamp_str, fmt)
            # Ensure UTC timezone
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat().replace('+00:00', 'Z')
        except ValueError:
            continue
    
    # If no format matches, return current timestamp
    return generate_timestamp()

def calculate_date_difference(date1_str, date2_str):
    """
    Calculate days between two dates.
    
    Args:
        date1_str: First date string
        date2_str: Second date string
    
    Returns:
        Integer number of days (date2 - date1)
    """
    date1 = datetime.fromisoformat(date1_str.replace('Z', '+00:00'))
    date2 = datetime.fromisoformat(date2_str.replace('Z', '+00:00'))
    return (date2 - date1).days

def main():
    """Main entry point - reads JSON from stdin, outputs JSON to stdout"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        operation = input_data.get('operation', 'generate')
        
        if operation == 'generate':
            # Generate current timestamp
            timestamp = generate_timestamp()
            result = {
                'success': True,
                'timestamp': timestamp,
                'formatted': timestamp
            }
            
        elif operation == 'format':
            # Format provided timestamp
            timestamp_str = input_data.get('timestamp', '')
            formatted = format_timestamp(timestamp_str)
            result = {
                'success': True,
                'original': timestamp_str,
                'formatted': formatted
            }
            
        elif operation == 'difference':
            # Calculate date difference
            date1 = input_data.get('date1', '')
            date2 = input_data.get('date2', '')
            days = calculate_date_difference(date1, date2)
            result = {
                'success': True,
                'date1': date1,
                'date2': date2,
                'days_difference': days
            }
        else:
            result = {
                'success': False,
                'error': f'Unknown operation: {operation}'
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