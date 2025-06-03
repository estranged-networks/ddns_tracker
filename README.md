# DDNS Tracker

A simple web-based Dynamic DNS tracker that monitors IP changes and updates Cloudflare DNS records automatically.Replace index.html with either the cyberpunk or matrix index for a visual alternative.

## Features

- 🌐 **Real-time IP Monitoring** - Automatically detects public IP changes
- 📊 **Historical Tracking** - History of DDNS IP updates
- 🎛️ **Web Dashboard** - Modern, responsive interface with 3 themes, normal, CyberPunk & Matrix
- 🐳 **Docker Ready** - Easy deployment with Docker Compose
- ⚙️ **Configurable** - Flexible update intervals and settings

## Quick Start

1. **Clone and Setup**

   ```
   git clone <repository-url>
   cd ddns-tracker
   cp .env.example .env
   ```
   
2. **Add your own details to the .env**
    ```
    CLOUDFLARE_EMAIL=your-email@example.com      # The email used to login 'https://dash.cloudflare.com'
    CLOUDFLARE_AUTH_METHOD=token                 # Set to "global" for Global API Key or "token" for Scoped API Token
    CLOUDFLARE_API_KEY=your-api-key-or-token     # Your API Token or Global API Key
    CLOUDFLARE_ZONE_ID=your-zone-identifier      # Can be found in the "Overview" tab of your domain
    CLOUDFLARE_RECORD_NAME=your-record-name      # Which record you want to be synced
    CLOUDFLARE_TTL=3600                          # Set the DNS TTL (seconds)
    CLOUDFLARE_PROXY=false                       # Set the proxy to true or false

    # Update interval in minutes (default: 5)
    UPDATE_INTERVAL=5
                       
    ```
3. **Build it**
     ```
     docker compose up --build
     ```
   
