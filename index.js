// NCDR Rainfall Data Visualization Dashboard
// Uses Vanilla JS, Leaflet for Maps, and Apache ECharts for Graphs

// --- Constants & Config ---
const NCDR_API_URL_BASE = "https://dataapi.ncdr.nat.gov.tw/NCDRAPI/OpenData/NCDR/ObsRain/";
const CACHE_KEY = "ncdr_weather_dashboard_cache";
const API_KEY_KEY = "ncdr_api_authorization_key";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

const COUNTIES = [
  "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", 
  "基隆市", "新竹市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", 
  "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", 
  "臺東縣", "澎湖縣"
];

// --- State Management ---
let state = {
  mode: "demo", // "demo" or "api"
  apiKey: "",
  weatherData: [],      // Cleaned active weather data (NCDR grids)
  filteredData: [],     // Filtered data based on UI search/filters
  selectedCounty: "all",
  searchQuery: "",
  mapMode: "rain",      // "rain" (standard values) or "alert" (warnings only)
  cacheTimer: null,
  charts: {}            // Store chart instances
};

// --- Rain Standard Levels (Taiwan CWA definitions used by NCDR) ---
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
// A geographically accurate representation of 32 grid nodes across Taiwan with diverse rainfall patterns.
const DEMO_NCDR_DATA = [
  // Taipei Grid nodes
  { Grid5000: "121.51_25.03", WGS84_Lon: 121.5149, WGS84_Lat: 25.0377, RainValue: 12.5, CityName: "臺北市", YY: "2026", MM: "06" },
  { Grid5000: "121.54_25.08", WGS84_Lon: 121.5435, WGS84_Lat: 25.0838, RainValue: 5.0, CityName: "臺北市", YY: "2026", MM: "06" },
  { Grid5000: "121.59_25.07", WGS84_Lon: 121.5946, WGS84_Lat: 25.0792, RainValue: 95.0, CityName: "臺北市", YY: "2026", MM: "06" }, // Heavy Rain
  { Grid5000: "121.53_25.16", WGS84_Lon: 121.5368, WGS84_Lat: 25.1621, RainValue: 135.5, CityName: "臺北市", YY: "2026", MM: "06" }, // Heavy Rain
  
  // New Taipei Grid nodes
  { Grid5000: "121.44_25.01", WGS84_Lon: 121.4420, WGS84_Lat: 25.0130, RainValue: 48.5, CityName: "新北市", YY: "2026", MM: "06" },
  { Grid5000: "121.37_24.93", WGS84_Lon: 121.3734, WGS84_Lat: 24.9360, RainValue: 245.0, CityName: "新北市", YY: "2026", MM: "06" }, // Extremely Heavy Rain
  { Grid5000: "121.72_25.02", WGS84_Lon: 121.7230, WGS84_Lat: 25.0240, RainValue: 180.0, CityName: "新北市", YY: "2026", MM: "06" },
  
  // Keelung
  { Grid5000: "121.74_25.13", WGS84_Lon: 121.7408, WGS84_Lat: 25.1333, RainValue: 35.0, CityName: "基隆市", YY: "2026", MM: "06" },
  
  // Taoyuan
  { Grid5000: "121.03_24.96", WGS84_Lon: 121.0315, WGS84_Lat: 24.9658, RainValue: 0.0, CityName: "桃園市", YY: "2026", MM: "06" },
  { Grid5000: "121.21_24.90", WGS84_Lon: 121.2150, WGS84_Lat: 24.9030, RainValue: 8.5, CityName: "桃園市", YY: "2026", MM: "06" },
  
  // Hsinchu
  { Grid5000: "120.97_24.82", WGS84_Lon: 120.9754, WGS84_Lat: 24.8279, RainValue: 0.0, CityName: "新竹市", YY: "2026", MM: "06" },
  { Grid5000: "121.15_24.70", WGS84_Lon: 121.1520, WGS84_Lat: 24.7040, RainValue: 12.0, CityName: "新竹縣", YY: "2026", MM: "06" },
  
  // Miaoli
  { Grid5000: "120.82_24.56", WGS84_Lon: 120.8220, WGS84_Lat: 24.5620, RainValue: 2.5, CityName: "苗栗縣", YY: "2026", MM: "06" },
  
  // Taichung
  { Grid5000: "120.68_24.14", WGS84_Lon: 120.6843, WGS84_Lat: 24.1457, RainValue: 1.0, CityName: "臺中市", YY: "2026", MM: "06" },
  { Grid5000: "120.95_24.25", WGS84_Lon: 120.9540, WGS84_Lat: 24.2560, RainValue: 56.0, CityName: "臺中市", YY: "2026", MM: "06" },
  
  // Changhua
  { Grid5000: "120.57_23.95", WGS84_Lon: 120.5739, WGS84_Lat: 23.9589, RainValue: 1.5, CityName: "彰化縣", YY: "2026", MM: "06" },
  
  // Nantou
  { Grid5000: "120.90_23.88", WGS84_Lon: 120.9081, WGS84_Lat: 23.8813, RainValue: 24.0, CityName: "南投縣", YY: "2026", MM: "06" },
  { Grid5000: "120.95_23.48", WGS84_Lon: 120.9595, WGS84_Lat: 23.4876, RainValue: 65.5, CityName: "南投縣", YY: "2026", MM: "06" },
  
  // Yunlin
  { Grid5000: "120.43_23.70", WGS84_Lon: 120.4320, WGS84_Lat: 23.7040, RainValue: 0.0, CityName: "雲林縣", YY: "2026", MM: "06" },
  
  // Chiayi
  { Grid5000: "120.45_23.48", WGS84_Lon: 120.4530, WGS84_Lat: 23.4820, RainValue: 0.0, CityName: "嘉義市", YY: "2026", MM: "06" },
  { Grid5000: "120.81_23.50", WGS84_Lon: 120.8130, WGS84_Lat: 23.5082, RainValue: 365.0, CityName: "嘉義縣", YY: "2026", MM: "06" }, // Torrential Rain!
  
  // Tainan
  { Grid5000: "120.20_22.99", WGS84_Lon: 120.2033, WGS84_Lat: 22.9932, RainValue: 0.0, CityName: "臺南市", YY: "2026", MM: "06" },
  
  // Kaohsiung
  { Grid5000: "120.30_22.56", WGS84_Lon: 120.3090, WGS84_Lat: 22.5660, RainValue: 0.0, CityName: "高雄市", YY: "2026", MM: "06" },
  { Grid5000: "120.65_22.90", WGS84_Lon: 120.6520, WGS84_Lat: 22.9040, RainValue: 4.0, CityName: "高雄市", YY: "2026", MM: "06" },
  
  // Pingtung
  { Grid5000: "120.74_22.00", WGS84_Lon: 120.7463, WGS84_Lat: 22.0039, RainValue: 0.0, CityName: "屏東縣", YY: "2026", MM: "06" },
  { Grid5000: "120.71_22.45", WGS84_Lon: 120.7120, WGS84_Lat: 22.4560, RainValue: 45.0, CityName: "屏東縣", YY: "2026", MM: "06" },
  
  // Yilan
  { Grid5000: "121.75_24.76", WGS84_Lon: 121.7565, WGS84_Lat: 24.7640, RainValue: 55.0, CityName: "宜蘭縣", YY: "2026", MM: "06" },
  
  // Hualien
  { Grid5000: "121.61_23.97", WGS84_Lon: 121.6133, WGS84_Lat: 23.9751, RainValue: 32.5, CityName: "花蓮縣", YY: "2026", MM: "06" },
  
  // Taitung
  { Grid5000: "121.15_22.75", WGS84_Lon: 121.1546, WGS84_Lat: 22.7522, RainValue: 0.0, CityName: "臺東縣", YY: "2026", MM: "06" },
  
  // Penghu
  { Grid5000: "119.56_23.56", WGS84_Lon: 119.5631, WGS84_Lat: 23.5654, RainValue: 0.0, CityName: "澎湖縣", YY: "2026", MM: "06" },
  
  // High extremes for alerts demonstration
  { Grid5000: "120.80_24.40", WGS84_Lon: 120.8040, WGS84_Lat: 24.4020, RainValue: 512.0, CityName: "苗栗縣", YY: "2026", MM: "06" }, // Extremely Torrential Rain!
  { Grid5000: "121.40_24.60", WGS84_Lon: 121.4020, WGS84_Lat: 24.6030, RainValue: 380.0, CityName: "宜蘭縣", YY: "2026", MM: "06" }  // Torrential Rain
];

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Icons
  lucide.createIcons();
  
  // 2. Load API Key from local storage if exists
  const storedKey = localStorage.getItem(API_KEY_KEY);
  if (storedKey) {
    state.apiKey = storedKey;
    state.mode = "api";
    document.getElementById("api-key-input").value = storedKey;
  }
  
  // 3. Initialize Map
  initMap();
  
  // 4. Bind Events
  bindEvents();
  
  // 5. Initial Data Load
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
  
  document.getElementById("btn-toggle-pw").addEventListener("click", () => {
    const input = document.getElementById("api-key-input");
    const icon = document.querySelector("#btn-toggle-pw i");
    if (input.type === "password") {
      input.type = "text";
      icon.setAttribute("data-lucide", "eye-off");
    } else {
      input.type = "password";
      icon.setAttribute("data-lucide", "eye");
    }
    lucide.createIcons();
  });

  document.getElementById("btn-save-api").addEventListener("click", () => {
    const val = document.getElementById("api-key-input").value.trim();
    if (val) {
      localStorage.setItem(API_KEY_KEY, val);
      state.apiKey = val;
      state.mode = "api";
      localStorage.removeItem(CACHE_KEY);
      modal.classList.remove("open");
      loadData();
    } else {
      alert("請輸入有效的 NCDR API 金鑰 Token。");
    }
  });

  document.getElementById("btn-demo-mode").addEventListener("click", () => {
    localStorage.removeItem(API_KEY_KEY);
    localStorage.removeItem(CACHE_KEY);
    state.apiKey = "";
    state.mode = "demo";
    document.getElementById("api-key-input").value = "";
    modal.classList.remove("open");
    loadData();
  });

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
    state.weatherData = JSON.parse(JSON.stringify(DEMO_NCDR_DATA));
    filterAndRender();
    startCacheCountdown(null);
    return;
  }
  
  // Mode: API. Check local cache
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

  // Fetch NCDR API concurrently for all 20 counties
  try {
    const fetchPromises = COUNTIES.map(async (county) => {
      const url = `${NCDR_API_URL_BASE}${encodeURIComponent(county)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Token": state.apiKey
        }
      });
      if (!response.ok) return [];
      return await response.json();
    });

    const results = await Promise.all(fetchPromises);
    const rawData = results.flat();
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new Error("API 未回傳資料或認證金鑰 Token 無效。");
    }

    state.weatherData = cleanNCDRData(rawData);
    
    const cacheObj = {
      timestamp: Date.now(),
      data: state.weatherData
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    
    filterAndRender();
    startCacheCountdown(cacheObj.timestamp);
  } catch (error) {
    console.error("NCDR API 介接失敗:", error);
    alert(`連接 NCDR 降雨 API 失敗: ${error.message}\n將切換為 Demo 模擬資料展示。`);
    state.mode = "demo";
    state.weatherData = JSON.parse(JSON.stringify(DEMO_NCDR_DATA));
    filterAndRender();
    startCacheCountdown(null);
  }
}

// --- NCDR Data Cleaner ---
function cleanNCDRData(rawData) {
  const cleanedList = [];
  
  rawData.forEach(item => {
    const lat = parseFloat(item.WGS84_Lat || item.Lat);
    const lon = parseFloat(item.WGS84_Lon || item.Lon);
    
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return;
    
    let rain = parseFloat(item.RainValue);
    if (isNaN(rain) || item.RainValue === "NaN" || rain < 0) {
      // Clean anomalies (NCDR uses "NaN" string for missing values)
      rain = null;
    }
    
    const county = item.CityName || item.County || item.CountyName || "未知縣市";
    const gridId = item.Grid5000 || `${lon.toFixed(2)}_${lat.toFixed(2)}`;
    
    cleanedList.push({
      GridId: gridId,
      StationName: `網格 ${gridId}`, // grid node behaves as station name
      StationLatitude: lat,
      StationLongitude: lon,
      CountyName: county.trim(),
      Precipitation: rain,
      YY: item.YY || "2026",
      MM: item.MM || "06"
    });
  });
  
  return cleanedList;
}

// --- Cache Timer ---
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

// --- Header UI Mode status ---
function updateHeaderUI() {
  const indicator = document.getElementById("mode-indicator");
  const modeText = document.getElementById("status-mode-text");
  
  if (state.mode === "demo") {
    indicator.className = "status-indicator demo";
    modeText.textContent = "Demo 模擬數據模式";
  } else {
    indicator.className = "status-indicator active";
    modeText.textContent = "NCDR 即時串接模式";
  }
}

// --- Filters mapping ---
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
                    st.GridId.toLowerCase().includes(state.searchQuery);
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
  
  // 1. Max Rain Grid
  if (validRainGrids.length > 0) {
    const maxRainSt = validRainGrids.reduce((prev, curr) => prev.Precipitation > curr.Precipitation ? prev : curr);
    document.getElementById("val-max-rain").textContent = `${maxRainSt.Precipitation.toFixed(1)} mm`;
    document.getElementById("loc-max-rain").textContent = `網格: ${maxRainSt.GridId} (${maxRainSt.CountyName})`;
  } else {
    document.getElementById("val-max-rain").textContent = "0.0 mm";
    document.getElementById("loc-max-rain").textContent = "無降雨網格";
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

  // 4. Grid counts
  document.getElementById("val-station-count").textContent = state.weatherData.length;
  document.getElementById("lbl-station-detail").textContent = `篩選後: ${state.filteredData.length} 網格`;
}

// --- Map Marker rendering ---
function renderMapMarkers() {
  stationMarkersGroup.clearLayers();
  
  if (state.filteredData.length === 0) return;
  
  const latLons = [];
  
  state.filteredData.forEach(st => {
    const lat = st.StationLatitude;
    const lon = st.StationLongitude;
    
    // NCDR ObsRain does not have Kinmen/Matsu, but if coordinates fall outside center view, we push it
    latLons.push([lat, lon]);

    const rain = st.Precipitation;
    
    // If in Alert Map Mode, only show markers that are under active warning (rain >= 40mm)
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

    const scale = rain > 150 ? 1.4 : (rain > 40 ? 1.2 : 1.0);

    // Dynamic Leaflet DivIcon
    const customIcon = L.divIcon({
      className: "custom-marker-icon",
      html: `<div style="
        width: 14px; 
        height: 14px; 
        background-color: ${markerColor}; 
        border: 2px solid #fff; 
        border-radius: 3px; /* square shape for NCDR grid system */
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
        <div class="popup-station-name">觀測網格 ${st.GridId}</div>
        <div class="popup-station-meta">${st.CountyName} | NCDR Grid Node</div>
      </div>
      <div class="popup-grid">
        <div class="popup-item">
          <span class="popup-label">經度 (WGS84)</span>
          <span class="popup-val">${lon.toFixed(4)}</span>
        </div>
        <div class="popup-item">
          <span class="popup-label">緯度 (WGS84)</span>
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
    marker.bindTooltip(`網格 ${st.GridId}: ${tooltipVal}`, {
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
        data: validRainList.map(st => `${st.CountyName} (${st.GridId})`),
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
          name: "網格數量",
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
