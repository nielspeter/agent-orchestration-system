#!/usr/bin/env python3
"""
name: random_roles
description: Randomly assign werewolf game roles to players
parameters:
  players: array - List of player names
"""
import json
import sys
import random

# Read input from stdin
data = json.load(sys.stdin)
players = data.get('players', [])

# Validate input
if len(players) != 3:
    print(json.dumps({
        'error': 'Exactly 3 players required',
        'provided': len(players)
    }))
    sys.exit(1)

# Define roles
roles = ['werewolf', 'seer', 'villager']

# Randomly shuffle roles
random.shuffle(roles)

# Assign roles to players
role_assignments = {}
for i, player in enumerate(players):
    role_assignments[player.lower()] = roles[i]

# Return the assignments
result = {
    'roles': role_assignments,
    'summary': f"{players[0]} is {role_assignments[players[0].lower()]}, {players[1]} is {role_assignments[players[1].lower()]}, {players[2]} is {role_assignments[players[2].lower()]}"
}

print(json.dumps(result))