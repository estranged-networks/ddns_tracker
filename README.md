# DDNS Tracker

A modern web-based Dynamic DNS tracker that monitors IP changes and updates Cloudflare DNS records automatically. Features a clean dashboard, historical tracking with Telegram notifications

## Features

- 🌐 **Real-time IP Monitoring** - Automatically detects public IP changes
- 📊 **Historical Tracking** - Complete history of all DNS updates
- 🔔 **Notifications** - Telegram
- 🎛️ **Web Dashboard** - Modern, responsive interface with 3 themes, normal, CyberPunk & Matrix
- 🐳 **Docker Ready** - Easy deployment with Docker Compose
- ⚙️ **Configurable** - Flexible update intervals and settings
- 📱 **Mobile Friendly** - Works great on all devices

## Quick Start

1. **Clone and Setup**

   ```
   git clone <repository-url>
   cd ddns-tracker
   cp .env.example .env
   ```
   
3. **Add your own details to the .env**
    ```
    CLOUDFLARE_EMAIL=your-email@example.com      # The email used to login 'https://dash.cloudflare.com'
    CLOUDFLARE_AUTH_METHOD=token                 # Set to "global" for Global API Key or "token" for Scoped API Token
    CLOUDFLARE_API_KEY=your-api-key-or-token     # Your API Token or Global API Key
    CLOUDFLARE_ZONE_ID=your-zone-identifier      # Can be found in the "Overview" tab of your domain
    CLOUDFLARE_RECORD_NAME=your-record-name      # Which record you want to be synced
    CLOUDFLARE_TTL=3600                          # Set the DNS TTL (seconds)
    CLOUDFLARE_PROXY=false                       # Set the proxy to true or false                            
    ```

   
