#!/bin/bash

echo "🚀 Starting Rehab Tracker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "📦 Starting Docker..."
    open -a Docker
    echo "⏳ Waiting for Docker to start..."
    sleep 20
fi

# Start or restart MongoDB
if docker ps -a | grep -q rehab-tracker-mongodb; then
    echo "🔄 Restarting MongoDB container..."
    docker start rehab-tracker-mongodb
else
    echo "📦 Creating MongoDB container..."
    docker run -d \
      --name rehab-tracker-mongodb \
      -p 27017:27017 \
      -v mongodb_data:/data/db \
      --restart unless-stopped \
      mongo:7.0
fi

sleep 3

echo "✅ MongoDB is running"
echo "🌐 Access your app at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "To stop: Run 'docker stop rehab-tracker-mongodb'"
