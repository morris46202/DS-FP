// Civil IoT Taiwan (CIOT) Rainfall Data Visualization Dashboard
// Uses Vanilla JS, Leaflet for Maps, and Apache ECharts for Graphs

// --- Constants & Config ---
const CIOT_API_URL = "https://sta.colife.org.tw/STA_RainSewer/v1.0/Things?$expand=Locations,Datastreams/Observations($orderby=phenomenonTime%20desc;$top=1)&$top=200";
const CACHE_KEY = "ciot_weather_dashboard_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

// --- State Management ---
let state = {
  mode: "live", // "live" (public connection, no key needed) or "demo"
  weatherData: [],      // Cleaned active weather data
  filteredData: [],     // Filtered data based on UI search/filters
  selectedCounty: "all",
  searchQuery: "",
  mapMode: "rain",      // "rain" (standard values) or "alert" (warnings only)
  cacheTimer: null,
  charts: {}            // Store chart instances
};

// --- Rain Standard Levels (Taiwan CWA definitions used by CIOT) ---
const RAIN_LEVELS = [
  { label: "無雨 (0 mm)", min: 0, max: 0.1, color: "#4b5563" },
  { label: "微量 (0.1-40 mm)", min: 0.1, max: 40, color: "#3b82f6" },
  { label: "大雨 (>= 40mm)", min: 40, max: 200, color: "#eab308" },
  { label: "豪雨 (>= 200mm)", min: 200, max: 350, color: "#f97316" },
  { label: "大豪雨 (>= 350mm)", min: 350, max: 500, color: "#ef4444" },
  { label: "超大豪雨 (>= 500mm)", min: 500, max: Infinity, color: "#c084fc" }
];

// --- Leaflet Map Instance ---
let map;
let stationMarkersGroup;

// --- Demo Mock Data ---
// 28 simulated rain gauge sensors corresponding to public下水道雨量計 (Sewer rain gauges)
const DEMO_CIOT_DATA = [
  { StationId: "STA_TPE_01", StationName: "信義防汛站", StationLatitude: 25.0333, StationLongitude: 121.5645, CountyName: "臺北市", Precipitation: 12.5 },
  { StationId: "STA_TPE_02", StationName: "大直抽水站", StationLatitude: 25.0812, StationLongitude: 121.5420, CountyName: "臺北市", Precipitation: 5.0 },
  { StationId: "STA_TPE_03", StationName: "內湖路二段", StationLatitude: 25.0792, StationLongitude: 121.5946, CountyName: "臺北市", Precipitation: 95.0 }, // Heavy Rain
  { StationId: "STA_TPE_04", StationName: "北投溫泉區", StationLatitude: 25.1375, StationLongitude: 121.5055, CountyName: "臺北市", Precipitation: 135.5 }, // Heavy Rain
  
  { StationId: "STA_NTPC_01", StationName: "板橋文化路", StationLatitude: 25.0130, StationLongitude: 121.4620, CountyName: "新北市", Precipitation: 48.5 },
  { StationId: "STA_NTPC_02", StationName: "三峽介壽路", StationLatitude: 24.9360, StationLongitude: 121.3734, CountyName: "新北市", Precipitation: 245.0 }, // Extremely Heavy Rain
  { StationId: "STA_NTPC_03", StationName: "汐止大同路", StationLatitude: 25.0630, StationLongitude: 121.6590, CountyName: "新北市", Precipitation: 180.0 },
  
  { StationId: "STA_KEE_01", StationName: "基隆港東岸", StationLatitude: 25.1333, StationLongitude: 121.7408, CountyName: "基隆市", Precipitation: 35.0 },
  
  { StationId: "STA_TYN_01", StationName: "中壢中正路", StationLatitude: 24.9535, StationLongitude: 121.2250, CountyName: "桃園市", Precipitation: 0.0 },
  { StationId: "STA_TYN_02", StationName: "桃園大興西路", StationLatitude: 25.0060, StationLongitude: 121.2980, CountyName: "桃園市", Precipitation: 8.5 },
  
  { StationId: "STA_HSC_01", StationName: "新竹關埔區", StationLatitude: 24.7890, StationLongitude: 121.0150, CountyName: "新竹市", Precipitation: 0.0 },
  { StationId: "STA_HSK_01", StationName: "竹北光明六路", StationLatitude: 24.8270, StationLongitude: 121.0120, CountyName: "新竹縣", Precipitation: 12.0 },
  
  { StationId: "STA_MIA_01", StationName: "苗栗中正路", StationLatitude: 24.5610, StationLongitude: 120.8210, CountyName: "苗栗縣", Precipitation: 512.0 }, // Extremely Torrential Rain!
  
  { StationId: "STA_TXG_01", StationName: "西屯市政路", StationLatitude: 24.1620, StationLongitude: 120.6400, CountyName: "臺中市", Precipitation: 1.0 },
  { StationId: "STA_TXG_02", StationName: "太平中山路", StationLatitude: 24.1280, StationLongitude: 120.7180, CountyName: "臺中市", Precipitation: 56.0 },
  
  { StationId: "STA_CHW_01", StationName: "彰化中山路", StationLatitude: 24.0810, StationLongitude: 120.5430, CountyName: "彰化縣", Precipitation: 1.5 },
  
  { StationId: "STA_NTO_01", StationName: "埔里中正路", StationLatitude: 23.9680, StationLongitude: 120.9680, CountyName: "南投縣", Precipitation: 24.0 },
  
  { StationId: "STA_YLN_01", StationName: "斗六民生路", StationLatitude: 23.7090, StationLongitude: 120.5430, CountyName: "雲林縣", Precipitation: 0.0 },
  
  { StationId: "STA_CYI_01", StationName: "嘉義中山路", StationLatitude: 23.4810, StationLongitude: 120.4530, CountyName: "嘉義市", Precipitation: 0.0 },
  { StationId: "STA_CYQ_01", StationName: "民雄工業區", StationLatitude: 23.5510, StationLongitude: 120.4280, CountyName: "嘉義縣", Precipitation: 365.0 }, // Torrential Rain
  
  { StationId: "STA_TNN_01", StationName: "永康中華路", StationLatitude: 23.0250, StationLongitude: 120.2430, CountyName: "臺南市", Precipitation: 0.0 },
  
  { StationId: "STA_KHH_01", StationName: "苓雅成功路", StationLatitude: 22.6160, StationLongitude: 120.2980, CountyName: "高雄市", Precipitation: 0.0 },
  { StationId: "STA_KHH_02", StationName: "鳳山光遠路", StationLatitude: 22.6250, StationLongitude: 120.3580, CountyName: "高雄市", Precipitation: 4.0 },
  
  { StationId: "STA_PTS_01", StationName: "屏東民生路", StationLatitude: 22.6680, StationLongitude: 120.4860, CountyName: "屏東縣", Precipitation: 0.0 },
  
  { StationId: "STA_ILA_01", StationName: "宜蘭神農路", StationLatitude: 24.7520, StationLongitude: 121.7510, CountyName: "宜蘭縣", Precipitation: 380.0 }, // Torrential Rain
  
  { StationId: "STA_HUN_01", StationName: "花蓮中山路", StationLatitude: 23.9780, StationLongitude: 121.6050, CountyName: "花蓮縣", Precipitation: 32.5 },
  
  { StationId: "STA_TTT_01", StationName: "臺東中華路", StationLatitude: 22.7560, StationLongitude: 121.1490, CountyName: "臺東縣", Precipitation: 0.0 },
  
  { StationId: "STA_PEN_01", StationName: "馬公中正路", StationLatitude: 23.5654, StationLongitude: 119.5631, CountyName: "澎湖縣", Precipitation: 0.0 }
];

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Icons
  lucide.createIcons();
  
  // 2. Initialize Map
  initMap();
  
  // 3. Bind Events
  bindEvents();
  
  // 4. Initial Data Load
  loadData();
});

// --- Map Initialization ---
function initMap() {
  map = L.map("map", {
    zoomControl: true,
    minZoom: 7,
    maxZoom: 15
  }).setView([23.8, 121.0], 8);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd"
  }).addTo(map);

  stationMarkersGroup = L.layerGroup().addTo(map);
}

// --- Bind Event Listeners ---
function bindEvents() {
  const modal = document.getElementById("api-modal");
  document.getElementById("btn-config-api").addEventListener("click", () => {
    modal.classList.add("open");
  });
  document.getElementById("modal-close").addEventListener("click", () => {
    modal.classList.remove("open");
  });
  
  // Modal OK button
  const okBtn = document.getElementById("btn-close-modal-ok");
  if (okBtn) {
    okBtn.addEventListener("click", () => {
      modal.classList.remove("open");
    });
  }

  // Refresh trigger
  document.getElementById("btn-refresh").addEventListener("click", () => {
    const icon = document.getElementById("icon-refresh");
    icon.classList.add("icon-pulse");
    localStorage.removeItem(CACHE_KEY);
    loadData().finally(() => {
      setTimeout(() => {
        icon.classList.remove("icon-pulse");
      }, 800);
    });
  });

  // Map layer toggle - Rain vs Alerts
  document.getElementById("map-mode-rain").addEventListener("click", () => {
    document.getElementById("map-mode-rain").classList.add("active");
    document.getElementById("map-mode-alert").classList.remove("active");
    state.mapMode = "rain";
    renderMapMarkers();
    renderMapLegend();
  });

  document.getElementById("map-mode-alert").addEventListener("click", () => {
    document.getElementById("map-mode-alert").classList.add("active");
    document.getElementById("map-mode-rain").classList.remove("active");
    state.mapMode = "alert";
    renderMapMarkers();
    renderMapLegend();
  });

  document.getElementById("select-county").addEventListener("change", (e) => {
    state.selectedCounty = e.target.value;
    filterAndRender();
  });

  document.getElementById("search-station-input").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    filterAndRender();
  });

  // Tab resizing / ECharts activation
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const tabId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active");
      });
      document.getElementById(tabId).classList.add("active");
      
      setTimeout(() => {
        Object.values(state.charts).forEach(chart => {
          if (chart) chart.resize();
        });
      }, 50);
    });
  });

  window.addEventListener("resize", () => {
    Object.values(state.charts).forEach(chart => {
      if (chart) chart.resize();
    });
  });
}

// --- Data Loader ---
async function loadData() {
  updateHeaderUI();
  
  if (state.mode === "demo") {
    state.weatherData = JSON.parse(JSON.stringify(DEMO_CIOT_DATA));
    filterAndRender();
    startCacheCountdown(null);
    return;
  }
  
  // Mode: Live. Check local storage cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const cacheObj = JSON.parse(cached);
      if (Date.now() - cacheObj.timestamp < CACHE_TTL_MS) {
        state.weatherData = cacheObj.data;
        filterAndRender();
        startCacheCountdown(cacheObj.timestamp);
        return;
      }
    } catch (e) {
      console.error("解析快取失敗", e);
    }
  }

  // Fetch CIOT API directly (No token required since Civil IoT API is public!)
  try {
    const response = await fetch(CIOT_API_URL);
    if (!response.ok) {
      throw new Error(`API 連線失敗，HTTP 代碼: ${response.status}`);
    }
    const rawData = await response.json();
    
    if (!rawData.value || !Array.isArray(rawData.value) || rawData.value.length === 0) {
      throw new Error("API 未回傳有效的 SensorThings value 陣列。");
    }

    state.weatherData = cleanCIOTData(rawData.value);
    
    const cacheObj = {
      timestamp: Date.now(),
      data: state.weatherData
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    
    filterAndRender();
    startCacheCountdown(cacheObj.timestamp);
  } catch (error) {
    console.error("CIOT API 讀取錯誤:", error);
    alert(`無法讀取民生公共物聯網降雨 API: ${error.message}\n系統將為您自動切換至 Demo 模擬資料。`);
    state.mode = "demo";
    state.weatherData = JSON.parse(JSON.stringify(DEMO_CIOT_DATA));
    filterAndRender();
    startCacheCountdown(null);
  }
}

// --- CIOT (SensorThings) Data Cleaner ---
function cleanCIOTData(things) {
  const cleanedList = [];
  
  things.forEach(thing => {
    // 1. Extract coordinates from standard OGC Locations array
    const loc = thing.Locations && thing.Locations[0] && thing.Locations[0].location;
    const coordinates = loc && loc.coordinates;
    const lon = coordinates ? parseFloat(coordinates[0]) : null;
    const lat = coordinates ? parseFloat(coordinates[1]) : null;
    
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return;
    
    // 2. Extract Rainfall from Datastreams
    let rain = null;
    if (thing.Datastreams && thing.Datastreams.length > 0) {
      // Find datastream corresponding to rain/precipitation
      const rainDs = thing.Datastreams.find(ds => ds.name && (ds.name.includes("雨量") || ds.name.includes("Rain") || ds.name.includes("Precipitation"))) || thing.Datastreams[0];
      if (rainDs && rainDs.Observations && rainDs.Observations.length > 0) {
        rain = parseFloat(rainDs.Observations[0].result);
      }
    }
    
    if (isNaN(rain) || rain < 0) {
      rain = null; // Clean missing/invalid values
    }
    
    // 3. Extract County name
    const name = thing.name || "未命名測站";
    let county = "未知縣市";
    if (thing.properties && thing.properties.county) {
      county = thing.properties.county;
    } else {
      // Regular expression matching county name inside station name string
      const matches = name.match(/(臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|澎湖縣)/);
      if (matches) county = matches[0];
    }
    
    cleanedList.push({
      StationId: thing["@iot.id"] || thing.name,
      StationName: name.replace("下水道雨量計-", "").replace("下水道雨量-", ""),
      StationLatitude: lat,
      StationLongitude: lon,
      CountyName: county.trim(),
      Precipitation: rain
    });
  });
  
  return cleanedList;
}

// --- Cache Countdown ---
function startCacheCountdown(timestamp) {
  if (state.cacheTimer) clearInterval(state.cacheTimer);
  const cacheContainer = document.getElementById("cache-container");
  const cacheText = document.getElementById("cache-time-text");
  
  if (!timestamp) {
    cacheContainer.style.display = "none";
    return;
  }
  
  cacheContainer.style.display = "flex";
  
  function updateCountdown() {
    const elapsed = Date.now() - timestamp;
    const remaining = CACHE_TTL_MS - elapsed;
    
    if (remaining <= 0) {
      cacheText.textContent = "快取已過期 (請更新)";
      clearInterval(state.cacheTimer);
    } else {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      cacheText.textContent = `快取中 (剩餘 ${minutes}:${seconds.toString().padStart(2, "0")})`;
    }
  }
  
  updateCountdown();
  state.cacheTimer = setInterval(updateCountdown, 1000);
}

// --- Header Mode indicator text ---
function updateHeaderUI() {
  const indicator = document.getElementById("mode-indicator");
  const modeText = document.getElementById("status-mode-text");
  
  if (state.mode === "demo") {
    indicator.className = "status-indicator demo";
    modeText.textContent = "Demo 模擬數據模式";
  } else {
    indicator.className = "status-indicator active";
    modeText.textContent = "CIOT 即時連線模式";
  }
}

// --- Filtering mapping ---
function filterAndRender() {
  state.filteredData = state.weatherData.filter(st => {
    let countyMatch = true;
    if (state.selectedCounty !== "all") {
      countyMatch = st.CountyName.includes(state.selectedCounty) || 
                    state.selectedCounty.includes(st.CountyName);
    }
    
    let searchMatch = true;
    if (state.searchQuery) {
      searchMatch = st.StationName.toLowerCase().includes(state.searchQuery) ||
                    st.CountyName.toLowerCase().includes(state.searchQuery) ||
                    st.StationId.toString().toLowerCase().includes(state.searchQuery);
    }
    
    return countyMatch && searchMatch;
  });

  updateKPIMetrics();
  renderMapMarkers();
  renderMapLegend();
  renderCharts();
}

// --- Metrics Calculations ---
function updateKPIMetrics() {
  const validRainGrids = state.weatherData.filter(st => st.Precipitation !== null);
  
  // 1. Max Rain station
  if (validRainGrids.length > 0) {
    const maxRainSt = validRainGrids.reduce((prev, curr) => prev.Precipitation > curr.Precipitation ? prev : curr);
    document.getElementById("val-max-rain").textContent = `${maxRainSt.Precipitation.toFixed(1)} mm`;
    document.getElementById("loc-max-rain").textContent = `${maxRainSt.StationName} (${maxRainSt.CountyName})`;
  } else {
    document.getElementById("val-max-rain").textContent = "0.0 mm";
    document.getElementById("loc-max-rain").textContent = "無降雨測站";
  }

  // 2. Average Rain
  if (validRainGrids.length > 0) {
    const totalRain = validRainGrids.reduce((sum, curr) => sum + curr.Precipitation, 0);
    const avgRain = totalRain / validRainGrids.length;
    document.getElementById("val-avg-rain").textContent = `${avgRain.toFixed(1)} mm`;
  } else {
    document.getElementById("val-avg-rain").textContent = "0.0 mm";
  }

  // 3. Alerts count (rain >= 40mm)
  const alertGrids = validRainGrids.filter(st => st.Precipitation >= 40);
  document.getElementById("val-alert-count").textContent = alertGrids.length;

  // 4. Active sensors count
  document.getElementById("val-station-count").textContent = state.weatherData.length;
  document.getElementById("lbl-station-detail").textContent = `篩選後: ${state.filteredData.length} 站`;
}

// --- Map Marker rendering ---
function renderMapMarkers() {
  stationMarkersGroup.clearLayers();
  
  if (state.filteredData.length === 0) return;
  
  const latLons = [];
  
  state.filteredData.forEach(st => {
    const lat = st.StationLatitude;
    const lon = st.StationLongitude;
    
    latLons.push([lat, lon]);

    const rain = st.Precipitation;
    
    if (state.mapMode === "alert" && (rain === null || rain < 40)) {
      return;
    }

    let markerColor = "#4b5563";
    let tooltipVal = "無資料";
    
    if (rain !== null) {
      const matchedLevel = RAIN_LEVELS.find(lvl => rain >= lvl.min && rain < lvl.max);
      markerColor = matchedLevel ? matchedLevel.color : "#4b5563";
      tooltipVal = `${rain.toFixed(1)} mm`;
    }

    const scale = rain > 150 ? 1.45 : (rain > 40 ? 1.25 : 1.0);

    // Leaflet Custom SVG Markers (looks beautiful)
    const customIcon = L.divIcon({
      className: "custom-marker-icon",
      html: `<div style="
        width: 14px; 
        height: 14px; 
        background-color: ${markerColor}; 
        border: 2px solid #fff; 
        border-radius: 50%; 
        box-shadow: 0 0 10px ${markerColor};
        transform: scale(${scale});
        transition: all 0.3s ease;
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([lat, lon], { icon: customIcon });
    
    // Alerts text formatting
    let rainAlertClass = "";
    let rainAlertText = "正常 / 無警戒";
    if (rain >= 500) {
      rainAlertText = "🔴 超大豪雨警戒";
      rainAlertClass = "background: rgba(192, 132, 252, 0.2); color: #c084fc; border: 1px solid #c084fc;";
    } else if (rain >= 350) {
      rainAlertText = "🔴 大豪雨警戒";
      rainAlertClass = "background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;";
    } else if (rain >= 200) {
      rainAlertText = "🟠 豪雨警戒";
      rainAlertClass = "background: rgba(249, 115, 22, 0.2); color: #f97316; border: 1px solid #f97316;";
    } else if (rain >= 40) {
      rainAlertText = "🟡 大雨警戒";
      rainAlertClass = "background: rgba(234, 179, 8, 0.2); color: #eab308; border: 1px solid #eab308;";
    } else if (rain > 0) {
      rainAlertText = "🟢 降雨進行中";
      rainAlertClass = "background: rgba(16, 185, 129, 0.15); color: #10b981;";
    }
    
    const popupContent = `
      <div class="popup-station-header">
        <div class="popup-station-name">${st.StationName}</div>
        <div class="popup-station-meta">${st.CountyName} | ID: ${st.StationId}</div>
      </div>
      <div class="popup-grid">
        <div class="popup-item">
          <span class="popup-label">經度</span>
          <span class="popup-val">${lon.toFixed(4)}</span>
        </div>
        <div class="popup-item">
          <span class="popup-label">緯度</span>
          <span class="popup-val">${lat.toFixed(4)}</span>
        </div>
        <div class="popup-item" style="grid-column: span 2; margin-top: 8px;">
          <span class="popup-label" style="font-size: 0.75rem;">累積降雨量</span>
          <span class="popup-val" style="color: #60a5fa; font-size: 1.25rem;">${rain !== null ? rain.toFixed(1) + ' mm' : '無資料'}</span>
        </div>
      </div>
      <div class="popup-rain-alert" style="${rainAlertClass || 'background: rgba(255, 255, 255, 0.05); color: var(--text-secondary);'}">
        ${rainAlertText}
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.bindTooltip(`${st.StationName}: ${tooltipVal}`, {
      direction: "top",
      offset: [0, -10],
      opacity: 0.85
    });

    stationMarkersGroup.addLayer(marker);
  });
  
  if (state.selectedCounty !== "all" && latLons.length > 0) {
    const bounds = L.latLngBounds(latLons);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
  } else if (state.selectedCounty === "all") {
    if (map.getZoom() > 9) {
      map.setView([23.8, 121.0], 8);
    }
  }
}

// --- Map Legend ---
function renderMapLegend() {
  const title = document.getElementById("legend-title");
  const container = document.getElementById("legend-items");
  container.innerHTML = "";
  
  if (state.mapMode === "alert") {
    title.textContent = "降雨警戒層級";
    RAIN_LEVELS.filter(lvl => lvl.min >= 40).forEach(lvl => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-color" style="background-color: ${lvl.color}"></span>
        <span>${lvl.label}</span>
      `;
      container.appendChild(item);
    });
  } else {
    title.textContent = "累積雨量 (mm)";
    RAIN_LEVELS.forEach(lvl => {
      const item = document.createElement("div");
      item.className = "legend-item";
      
      let valText = "";
      if (lvl.min === 0 && lvl.max === 0.1) valText = "0 mm";
      else if (lvl.max === Infinity) valText = `> ${lvl.min} mm`;
      else valText = `${lvl.min}-${lvl.max} mm`;
      
      item.innerHTML = `
        <span class="legend-color" style="background-color: ${lvl.color}"></span>
        <span>${lvl.label.split(" ")[0]} (${valText})</span>
      `;
      container.appendChild(item);
    });
  }
}

// --- ECharts plotting ---
function renderCharts() {
  // 1. Rain Rankings (Highest 15)
  const textStyle = { color: "#9ca3af", fontFamily: "Outfit, Noto Sans TC, sans-serif" };
  const validRainList = [...state.filteredData]
    .filter(st => st.Precipitation !== null)
    .sort((a, b) => b.Precipitation - a.Precipitation)
    .slice(0, 15)
    .reverse();

  const rainChartDom = document.getElementById("chart-rain-ranking");
  if (rainChartDom) {
    if (!state.charts.rainRank) {
      state.charts.rainRank = echarts.init(rainChartDom);
    }
    
    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: "{b}: {c} mm"
      },
      grid: { left: "4%", right: "8%", bottom: "3%", top: "4%", containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: { textStyle: textStyle }
      },
      yAxis: {
        type: "category",
        data: validRainList.map(st => `${st.CountyName} - ${st.StationName}`),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { textStyle: textStyle }
      },
      series: [
        {
          name: "累積雨量",
          type: "bar",
          data: validRainList.map(st => st.Precipitation),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#3b82f6" },
              { offset: 0.7, color: "#10b981" },
              { offset: 1, color: "#eab308" }
            ]),
            borderRadius: [0, 4, 4, 0]
          },
          barWidth: "60%"
        }
      ]
    };
    state.charts.rainRank.setOption(option);
  }

  // 2. Rainfall Histogram Chart
  const histChartDom = document.getElementById("chart-rain-histogram");
  if (histChartDom) {
    if (!state.charts.histogram) {
      state.charts.histogram = echarts.init(histChartDom);
    }

    // Bin grids by rain thresholds
    const bins = { "0 mm (無雨)": 0, "0.1-40 mm (微量)": 0, "40-200 mm (大雨)": 0, "200-350 mm (豪雨)": 0, "350-500 mm (大豪雨)": 0, ">=500 mm (超大豪雨)": 0 };
    state.filteredData.forEach(st => {
      const r = st.Precipitation;
      if (r === null || r < 0.1) bins["0 mm (無雨)"]++;
      else if (r < 40) bins["0.1-40 mm (微量)"]++;
      else if (r < 200) bins["40-200 mm (大雨)"]++;
      else if (r < 350) bins["200-350 mm (豪雨)"]++;
      else if (r < 500) bins["350-500 mm (大豪雨)"]++;
      else bins[">=500 mm (超大豪雨)"]++;
    });

    const option = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: "4%", right: "4%", bottom: "8%", top: "8%", containLabel: true },
      xAxis: {
        type: "category",
        data: Object.keys(bins),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { textStyle: textStyle, interval: 0, rotate: 15 }
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: { textStyle: textStyle }
      },
      series: [
        {
          name: "測站數量",
          type: "bar",
          data: Object.values(bins),
          itemStyle: {
            color: function (params) {
              const colors = ["#4b5563", "#3b82f6", "#eab308", "#f97316", "#ef4444", "#c084fc"];
              return colors[params.dataIndex];
            },
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: "50%"
        }
      ]
    };
    state.charts.histogram.setOption(option);
  }

  // 3. County Average/Max Rainfall
  const countyChartDom = document.getElementById("chart-county-bar");
  if (countyChartDom) {
    if (!state.charts.county) {
      state.charts.county = echarts.init(countyChartDom);
    }

    const countyGroup = {};
    state.filteredData.forEach(st => {
      const c = st.CountyName;
      if (!countyGroup[c]) {
        countyGroup[c] = [];
      }
      if (st.Precipitation !== null) countyGroup[c].push(st.Precipitation);
    });

    const counties = Object.keys(countyGroup);
    const avgRains = [];
    const maxRains = [];

    counties.forEach(c => {
      const list = countyGroup[c];
      const avg = list.length > 0 ? (list.reduce((sum, v) => sum + v, 0) / list.length) : 0;
      const max = list.length > 0 ? Math.max(...list) : 0;
      avgRains.push(parseFloat(avg.toFixed(1)));
      maxRains.push(parseFloat(max.toFixed(1)));
    });

    const option = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { data: ["縣市平均雨量", "縣市最高雨量"], textStyle: textStyle, bottom: "0" },
      grid: { left: "4%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
      xAxis: [
        {
          type: "category",
          data: counties,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { textStyle: textStyle, interval: 0, rotate: counties.length > 10 ? 35 : 0 }
        }
      ],
      yAxis: [
        {
          type: "value",
          name: "累積雨量 (mm)",
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
          axisLabel: { textStyle: textStyle }
        }
      ],
      series: [
        {
          name: "縣市平均雨量",
          type: "bar",
          data: avgRains,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#3b82f6" },
              { offset: 1, color: "rgba(59, 130, 246, 0.1)" }
            ]),
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: "縣市最高雨量",
          type: "line",
          data: maxRains,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#f43f5e", width: 2.5 },
          itemStyle: { color: "#f43f5e" }
        }
      ]
    };
    state.charts.county.setOption(option);
  }
}
