#!/bin/bash

echo "🧪 Setting up test users for Rehab Tracker..."
echo ""

API_URL="http://localhost:3001/api"

# Create Patient
echo "Creating test patient..."
curl -s "$API_URL/auth/register" -H "Content-Type: application/json" -d '{
  "firstName": "Test",
  "lastName": "Patient",
  "email": "patient@test.com",
  "password": "password123",
  "role": "patient",
  "phoneNumber": "+1234567890"
}' > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Patient: patient@test.com / password123"
else
  echo "⚠️ Patient user may already exist"
fi

# Create Physiotherapist
echo "Creating test physiotherapist..."
curl -s "$API_URL/auth/register" -H "Content-Type: application/json" -d '{
  "firstName": "Test",
  "lastName": "Physiotherapist",
  "email": "physio@test.com",
  "password": "password123",
  "role": "physiotherapist",
  "phoneNumber": "+1234567891"
}' > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Physiotherapist: physio@test.com / password123"
else
  echo "⚠️ Physiotherapist user may already exist"
fi

# Create Doctor
echo "Creating test doctor..."
curl -s "$API_URL/auth/register" -H "Content-Type: application/json" -d '{
  "firstName": "Test",
  "lastName": "Doctor",
  "email": "doctor@test.com",
  "password": "password123",
  "role": "doctor",
  "phoneNumber": "+1234567892"
}' > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Doctor: doctor@test.com / password123"
else
  echo "⚠️ Doctor user may already exist"
fi

echo ""
echo "✅ Test users setup complete!"
echo ""
echo "You can now login with:"
echo "  Patient: patient@test.com / password123"
echo "  Physiotherapist: physio@test.com / password123"
echo "  Doctor: doctor@test.com / password123"
