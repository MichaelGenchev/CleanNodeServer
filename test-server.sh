#!/bin/bash

# Define IP address and port as variables
ip_address="127.0.0.2"
port="9999"

# Send a request with the "ask_key" field
ask_key_response=$(curl -s -X POST -d "ask_key=unique_id_123" "http://$ip_address:$port/")

# Check if the ask_key_response is valid

# Use the response to login
login_response=$(curl -s -X POST -d "login=$ask_key_response" "http://$ip_address:$port/")

# Check if the login_response is valid and equal to unique_id_123
if [[ $login_response =~ ^unique_id_123$ ]]; then
echo "Login successful! Unique ID: $login_response"
else
echo "Login failed. Error: $login_response"
fi
