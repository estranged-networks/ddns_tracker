const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const fs = require("fs")
const cron = require("node-cron")

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// Serve the main HTML file at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Handle favicon requests
app.get("/favicon.ico", (req, res) => {
  res.status(204).end()
})

// Environment variables with defaults
const CONFIG = {
  auth_email: process.env.CLOUDFLARE_EMAIL || "",
  auth_method: process.env.CLOUDFLARE_AUTH_METHOD || "token", // "global" or "token"
  auth_key: process.env.CLOUDFLARE_API_KEY || "",
  zone_identifier: process.env.CLOUDFLARE_ZONE_ID || "",
  record_name: process.env.CLOUDFLARE_RECORD_NAME || "",
  ttl: Number.parseInt(process.env.CLOUDFLARE_TTL) || 3600,
  proxy: process.env.CLOUDFLARE_PROXY === "true",
  sitename: process.env.SITE_NAME || "DDNS Tracker",
  update_interval: Number.parseInt(process.env.UPDATE_INTERVAL) || 5, // minutes
}

// Initialize SQLite database
const dbPath = path.join(__dirname, "data", "ddns.db")
const db = new sqlite3.Database(dbPath)

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS ddns_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        old_ip TEXT,
        new_ip TEXT,
        success BOOLEAN,
        notes TEXT
    )`)

  db.run(`CREATE TABLE IF NOT EXISTS ddns_status (
        id INTEGER PRIMARY KEY,
        current_ip TEXT,
        last_update DATETIME,
        last_change DATETIME,
        total_updates INTEGER DEFAULT 0
    )`)

  // Initialize status record if it doesn't exist
  db.run(`INSERT OR IGNORE INTO ddns_status (id, total_updates) VALUES (1, 0)`)
})

// Utility functions
async function getCurrentIP() {
  try {
    const response = await fetch("https://cloudflare.com/cdn-cgi/trace")
    const text = await response.text()
    const ipMatch = text.match(/ip=([^\n]+)/)

    if (ipMatch) {
      return ipMatch[1]
    }

    // Fallback to other services
    const fallbackResponse = await fetch("https://api.ipify.org")
    return await fallbackResponse.text()
  } catch (error) {
    console.error("Failed to get current IP:", error)
    throw error
  }
}

async function getCloudflareRecord() {
  // Check and set the proper auth header (from original script)
  let auth_header, auth_value
  if (CONFIG.auth_method === "global") {
    auth_header = "X-Auth-Key"
    auth_value = CONFIG.auth_key
  } else {
    auth_header = "Authorization"
    auth_value = `Bearer ${CONFIG.auth_key}`
  }

  console.log(`Using auth method: ${CONFIG.auth_method}`)

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CONFIG.zone_identifier}/dns_records?type=A&name=${CONFIG.record_name}`,
    {
      headers: {
        "X-Auth-Email": CONFIG.auth_email,
        [auth_header]: auth_value,
        "Content-Type": "application/json",
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Cloudflare API error: ${response.status} - ${JSON.stringify(data)}`)
  }

  if (!data.success) {
    throw new Error(`Cloudflare API returned error: ${JSON.stringify(data.errors)}`)
  }

  if (data.result.length === 0) {
    throw new Error(`DNS record not found. Make sure the A record '${CONFIG.record_name}' exists in your zone.`)
  }

  return data.result[0]
}

async function updateCloudflareRecord(recordId, newIP) {
  // Check and set the proper auth header (from original script)
  let auth_header, auth_value
  if (CONFIG.auth_method === "global") {
    auth_header = "X-Auth-Key"
    auth_value = CONFIG.auth_key
  } else {
    auth_header = "Authorization"
    auth_value = `Bearer ${CONFIG.auth_key}`
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CONFIG.zone_identifier}/dns_records/${recordId}`,
    {
      method: "PATCH",
      headers: {
        "X-Auth-Email": CONFIG.auth_email,
        [auth_header]: auth_value,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "A",
        name: CONFIG.record_name,
        content: newIP,
        ttl: CONFIG.ttl,
        proxied: CONFIG.proxy,
      }),
    },
  )

  const data = await response.json()
  return data.success
}

async function performDDNSUpdate() {
  try {
    console.log("DDNS Updater: Check Initiated")

    const currentIP = await getCurrentIP()
    const record = await getCloudflareRecord()
    const oldIP = record.content

    // Compare if they're the same
    if (currentIP === oldIP) {
      console.log(`DDNS Updater: IP (${currentIP}) for ${CONFIG.record_name} has not changed.`)

      // Update last check time
      db.run("UPDATE ddns_status SET last_update = CURRENT_TIMESTAMP WHERE id = 1")
      [currentIP])
      return { success: true, changed: false, ip: currentIP }
    }

    console.log(`DDNS Updater: IP changed from ${oldIP} to ${currentIP}, updating DNS...`)

    const updateSuccess = await updateCloudflareRecord(record.id, currentIP)

    if (updateSuccess) {
      console.log(`DDNS Updater: ${currentIP} ${CONFIG.record_name} DDNS updated.`)

      // Log to database
      db.run("INSERT INTO ddns_history (old_ip, new_ip, success, notes) VALUES (?, ?, ?, ?)", [
        oldIP,
        currentIP,
        true,
        "Automatic update",
      ])

      // Update status
      db.run(
        `UPDATE ddns_status SET 
                 current_ip = ?, 
                 last_update = CURRENT_TIMESTAMP, 
                 last_change = CURRENT_TIMESTAMP,
                 total_updates = total_updates + 1 
                 WHERE id = 1`,
        [currentIP],
      )

      return { success: true, changed: true, ip: currentIP, oldIP }
    } else {
      console.error(`DDNS Updater: ${currentIP} ${CONFIG.record_name} DDNS failed.`)

      // Log failure
      db.run("INSERT INTO ddns_history (old_ip, new_ip, success, notes) VALUES (?, ?, ?, ?)", [
        oldIP,
        currentIP,
        false,
        "Update failed",
      ])

      return { success: false, error: "Cloudflare update failed" }
    }
  } catch (error) {
    console.error("DDNS update error:", error.message)

    // Log error
    db.run("INSERT INTO ddns_history (old_ip, new_ip, success, notes) VALUES (?, ?, ?, ?)", [
      null,
      null,
      false,
      error.message,
    ])

    return { success: false, error: error.message }
  }
}

// API Routes
app.get("/api/status", (req, res) => {
  db.get(
    `SELECT current_ip, last_update, last_change, total_updates 
         FROM ddns_status WHERE id = 1`,
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }

      const uptime = process.uptime()
      const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`

      res.json({
        ...row,
        record_name: CONFIG.record_name,
        zone_id: CONFIG.zone_identifier,
        ttl: CONFIG.ttl,
        proxy: CONFIG.proxy,
        uptime: uptimeString,
        update_interval: CONFIG.update_interval,
      })
    },
  )
})

app.get("/api/history", (req, res) => {
  db.all("SELECT * FROM ddns_history ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    res.json(rows)
  })
})

app.post("/api/update", async (req, res) => {
  try {
    const result = await performDDNSUpdate()
    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Cron job setup
let currentCronJob = null

function setupCronJob(intervalMinutes = CONFIG.update_interval) {
  if (currentCronJob) {
    currentCronJob.stop()
    currentCronJob = null
  }

  const cronExpression = `*/${intervalMinutes} * * * *`
  console.log(`Setting up cron job with expression: ${cronExpression} (every ${intervalMinutes} minutes)`)

  currentCronJob = cron.schedule(cronExpression, () => {
    performDDNSUpdate()
  })
}

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, "data")
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Start server
app.listen(PORT, () => {
  console.log(`DDNS Tracker running on port ${PORT}`)
  console.log(`Dashboard available at http://localhost:${PORT}`)
  console.log(`Update interval: ${CONFIG.update_interval} minutes`)

  // Setup initial cron job
  setupCronJob()

  // Perform initial update
  setTimeout(() => {
    performDDNSUpdate()
  }, 5000)
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...")
  if (currentCronJob) {
    currentCronJob.stop()
  }
  db.close()
  process.exit(0)
})
