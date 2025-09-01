#!/usr/bin/env python3
"""
name: word_counter
description: Count words in text
parameters:
  text: string
"""
import sys
import json

data = json.load(sys.stdin)
text = data.get('text', '')
words = text.split()
result = {
  'word_count': len(words),
  'character_count': len(text),
  'words': words[:5]  # First 5 words
}
print(json.dumps(result))
