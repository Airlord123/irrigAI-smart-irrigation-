let moistureChart = null;
let climateChart = null;

let bleDevice = null;
let bleServer = null;
let bleService = null;
let telemetryCharacteristic = null;
let configCharacteristic = null;
let calibrationCharacteristic = null;
let commandCharacteristic = null;

const SERVICE_UUID = "a1b0c0d0-e0f0-1020-3040-5060708090a0";
const TELEMETRY_UUID = "a1b0c0d1-e0f0-1020-3040-5060708090a0";
const CONFIG_UUID = "a1b0c0d2-e0f0-1020-3040-5060708090a0";
const CALIBRATION_UUID = "a1b0c0d3-e0f0-1020-3040-5060708090a0";
const COMMAND_UUID = "a1b0c0d4-e0f0-1020-3040-5060708090a0";

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ts-channel-id').value = localStorage.getItem('ts_channel_id') || '';
    document.getElementById('ts-read-key').value = localStorage.getItem('ts_read_key') || '';
    
    if (localStorage.getItem('ts_channel_id')) {
        loadThingSpeakData();
    }
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tabId === 'cloud') {
        event.currentTarget.classList.add('active');
        document.getElementById('cloud-section').classList.add('active');
    } else {
        event.currentTarget.classList.add('active');
        document.getElementById('local-section').classList.add('active');
    }
}

async function loadThingSpeakData() {
    const channelId = document.getElementById('ts-channel-id').value.trim();
    const readKey = document.getElementById('ts-read-key').value.trim();

    if (!channelId) {
        alert("Please enter your ThingSpeak Channel ID.");
        return;
    }

    localStorage.setItem('ts_channel_id', channelId);
    localStorage.setItem('ts_read_key', readKey);

    let url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?results=30`;
    if (readKey) {
        url += `&api_key=${readKey}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network error");
        const data = await response.json();
        
        if (data.feeds && data.feeds.length > 0) {
            const latest = data.feeds[data.feeds.length - 1];
            
            document.getElementById('cloud-temp').innerText = latest.field1 ? `${parseFloat(latest.field1).toFixed(1)}°C` : '--°C';
            document.getElementById('cloud-humid').innerText = latest.field2 ? `${parseFloat(latest.field2).toFixed(1)}%` : '--%';
            document.getElementById('cloud-moisture').innerText = latest.field3 ? `${parseFloat(latest.field3).toFixed(1)}%` : '--%';
            
            const pumpState = parseInt(latest.field4);
            document.getElementById('cloud-pump').innerText = pumpState === 1 ? 'ON' : 'OFF';
            document.getElementById('cloud-pump').style.color = pumpState === 1 ? 'var(--accent-emerald)' : 'var(--text-primary)';
            
            renderCharts(data.feeds);
        } else {
            alert("No data feeds found on this channel.");
        }
    } catch (error) {
        console.error("Error fetching ThingSpeak data:", error);
        alert("Failed to load ThingSpeak. Verify details.");
    }
}

function renderCharts(feeds) {
    const labels = feeds.map(feed => {
        const date = new Date(feed.created_at);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    
    const moistureData = feeds.map(feed => feed.field3 ? parseFloat(feed.field3) : null);
    const tempData = feeds.map(feed => feed.field1 ? parseFloat(feed.field1) : null);
    const humidData = feeds.map(feed => feed.field2 ? parseFloat(feed.field2) : null);

    if (moistureChart) moistureChart.destroy();
    const ctxMoisture = document.getElementById('moistureChart').getContext('2d');
    moistureChart = new Chart(ctxMoisture, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Moisture (%)',
                data: moistureData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    if (climateChart) climateChart.destroy();
    const ctxClimate = document.getElementById('climateChart').getContext('2d');
    climateChart = new Chart(ctxClimate, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temp (°C)',
                    data: tempData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'yTemp',
                    spanGaps: true
                },
                {
                    label: 'Humidity (%)',
                    data: humidData,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'yHumid',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                yTemp: {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: { display: true, text: 'Temp (°C)' }
                },
                yHumid: {
                    type: 'linear',
                    position: 'right',
                    grid: { display: false },
                    title: { display: true, text: 'Humidity (%)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

async function toggleBLEConnection() {
    const connBtn = document.getElementById('ble-connect-btn');
    const statusText = document.getElementById('ble-status-text');
    const indicator = document.getElementById('ble-indicator');

    if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
        return;
    }

    try {
        statusText.innerText = "Scanning Bluetooth...";
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { name: "EdgeAI_Irrigation" },
                { services: [SERVICE_UUID] }
            ],
            optionalServices: [SERVICE_UUID]
        });

        statusText.innerText = "Connecting GATT...";
        bleDevice.addEventListener('gattserverdisconnected', onBLEDisconnected);

        bleServer = await bleDevice.gatt.connect();
        statusText.innerText = "Fetching service...";
        bleService = await bleServer.getPrimaryService(SERVICE_UUID);

        statusText.innerText = "Subscribing characteristics...";
        telemetryCharacteristic = await bleService.getCharacteristic(TELEMETRY_UUID);
        configCharacteristic = await bleService.getCharacteristic(CONFIG_UUID);
        calibrationCharacteristic = await bleService.getCharacteristic(CALIBRATION_UUID);
        commandCharacteristic = await bleService.getCharacteristic(COMMAND_UUID);

        await telemetryCharacteristic.startNotifications();
        telemetryCharacteristic.addEventListener('characteristicvaluechanged', handleTelemetryNotification);

        connBtn.innerText = "Disconnect";
        connBtn.classList.add('connected');
        statusText.innerText = "Connected to " + bleDevice.name;
        indicator.className = "status-indicator connected";
    } catch (error) {
        console.error("BLE Connect failed:", error);
        statusText.innerText = "Connection failed";
        indicator.className = "status-indicator disconnected";
        alert("BLE Error: " + error.message);
    }
}

function onBLEDisconnected() {
    const connBtn = document.getElementById('ble-connect-btn');
    connBtn.innerText = "Scan & Connect";
    connBtn.classList.remove('connected');
    
    document.getElementById('ble-status-text').innerText = "Disconnected from Device";
    document.getElementById('ble-indicator').className = "status-indicator disconnected";

    document.getElementById('local-moisture').innerText = "--%";
    document.getElementById('local-raw-moisture').innerText = "Raw ADC: --";
    document.getElementById('local-temp').innerText = "--°C";
    document.getElementById('local-humid').innerText = "--%";
    document.getElementById('local-pump-text').innerText = "OFF";
    document.getElementById('local-pump-card').classList.remove('pump-active-animation');
    document.getElementById('local-safety-cutoff').style.display = 'none';
    document.getElementById('ai-samples-count').innerText = "-- / 50";
    document.getElementById('ai-loss-val').innerText = "--";
    document.getElementById('cal-dry-val').innerText = "--";
    document.getElementById('cal-wet-val').innerText = "--";
    document.getElementById('weights-grid').innerText = "Connecting to BLE to fetch weights...";

    bleDevice = null;
    bleServer = null;
    bleService = null;
    telemetryCharacteristic = null;
    configCharacteristic = null;
    calibrationCharacteristic = null;
    commandCharacteristic = null;
}

function handleTelemetryNotification(event) {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(value);
    
    try {
        const data = JSON.parse(jsonString);
        
        document.getElementById('local-moisture').innerText = `${parseFloat(data.moist).toFixed(1)}%`;
        document.getElementById('local-raw-moisture').innerText = `Raw ADC: ${data.raw}`;
        document.getElementById('local-temp').innerText = `${parseFloat(data.temp).toFixed(1)}°C`;
        document.getElementById('local-humid').innerText = `${parseFloat(data.humid).toFixed(1)}%`;
        
        const pumpRunning = (parseInt(data.pump) === 1);
        const pumpText = document.getElementById('local-pump-text');
        const pumpCard = document.getElementById('local-pump-card');
        
        if (pumpRunning) {
            pumpText.innerText = "RUNNING";
            pumpText.style.color = "var(--accent-emerald)";
            pumpCard.classList.add('pump-active-animation');
        } else {
            pumpText.innerText = "OFF";
            pumpText.style.color = "var(--text-primary)";
            pumpCard.classList.remove('pump-active-animation');
        }

        const safetyCutoff = (parseInt(data.safety) === 1);
        document.getElementById('local-safety-cutoff').style.display = safetyCutoff ? 'block' : 'none';

        const autoMode = (parseInt(data.auto) === 1);
        document.getElementById('auto-mode-checkbox').checked = autoMode;

        document.getElementById('ai-samples-count').innerText = `${data.samples} / 50`;
        document.getElementById('ai-loss-val').innerText = parseFloat(data.loss).toFixed(5);
        
        document.getElementById('cal-dry-val').innerText = data.dry_cal;
        document.getElementById('cal-wet-val').innerText = data.wet_cal;

        renderWeightsGrid(data.weights);
    } catch (e) {
        console.error("JSON parsing error:", e);
    }
}

function renderWeightsGrid(weightsCSV) {
    const grid = document.getElementById('weights-grid');
    if (!weightsCSV) {
        grid.innerText = "No weight matrix transmitted.";
        return;
    }

    const w = weightsCSV.split(',');
    if (w.length < 17) {
        grid.innerText = "Parsing weights error.";
        return;
    }

    let html = `<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">`;
    html += `<div style="grid-column: span 4; font-weight:bold; color:var(--accent-violet); border-bottom: 1px solid var(--border-color); padding-bottom:4px; margin-bottom:4px;">Layer 1: Input to Hidden Synapses</div>`;
    
    for (let i = 0; i < 3; i++) {
        let sensorLabel = ["Moist", "Temp", "Humid"][i];
        for (let j = 0; j < 4; j++) {
            let val = parseFloat(w[i*4 + j]).toFixed(2);
            let color = val >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)";
            html += `<div style="font-size:0.75rem;">${sensorLabel}→H${j}: <span style="color:${color};font-weight:bold">${val}</span></div>`;
        }
    }
    
    html += `<div style="grid-column: span 4; font-weight:bold; color:var(--accent-violet); border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); padding: 4px 0; margin: 4px 0;">Layer 2: Hidden to Output Synapses</div>`;
    
    for (let j = 0; j < 4; j++) {
        let val = parseFloat(w[12 + j]).toFixed(2);
        let color = val >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)";
        html += `<div style="font-size:0.75rem;">H${j}→Out: <span style="color:${color};font-weight:bold">${val}</span></div>`;
    }

    let biasVal = parseFloat(w[16]).toFixed(2);
    let biasColor = biasVal >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)";
    html += `<div style="grid-column: span 4; font-size:0.75rem; border-top: 1px solid var(--border-color); padding-top:4px; margin-top:4px;">Bias: <span style="color:${biasColor};font-weight:bold">${biasVal}</span></div>`;
    
    html += `</div>`;
    grid.innerHTML = html;
}

async function sendBLECommand(commandStr) {
    if (!commandCharacteristic) {
        alert("Action failed: Bluetooth disconnected.");
        return;
    }
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(commandStr);
        await commandCharacteristic.writeValue(data);
    } catch (error) {
        console.error("Command writing error:", error);
    }
}

async function sendBLECalibration(calibStr) {
    if (!calibrationCharacteristic) {
        alert("Action failed: Bluetooth disconnected.");
        return;
    }
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(calibStr);
        await calibrationCharacteristic.writeValue(data);
    } catch (error) {
        console.error("Calibration writing error:", error);
    }
}

function toggleAutoMode(checkbox) {
    if (checkbox.checked) {
        sendBLECommand("AUTO_ON");
    } else {
        sendBLECommand("AUTO_OFF");
    }
}

async function uploadWiFiConfig() {
    if (!configCharacteristic) {
        alert("Upload failed: Bluetooth disconnected.");
        return;
    }

    const ssid = document.getElementById('wifi-ssid').value.trim();
    const pass = document.getElementById('wifi-pass').value.trim();
    const tsKey = document.getElementById('wifi-ts-key').value.trim();

    if (!ssid) {
        alert("SSID cannot be empty.");
        return;
    }

    const packet = `${ssid}:${pass}:${tsKey}`;

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(packet);
        await configCharacteristic.writeValue(data);
        alert("Config written to ESP32! Setting up connection...");
    } catch (error) {
        console.error("Configuration error:", error);
        alert("Upload failed: " + error.message);
    }
}
