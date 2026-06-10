// CWA Weather and Rainfall Data Visualization Dashboard
// Uses Vanilla JS, Leaflet for Maps, and Apache ECharts for Graphs

// --- Constants & Config ---
const CWA_API_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001";
const CACHE_KEY = "cwa_weather_dashboard_cache";
const API_KEY_KEY = "cwa_api_authorization_key";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

// --- State Management ---
let state = {
  mode: "demo", // "demo" or "api"
  apiKey: "",
  weatherData: [],      // Cleaned active weather data
  filteredData: [],     // Filtered data based on UI search/filters
  selectedCounty: "all",
  searchQuery: "",
  mapMode: "temp",      // "temp" or "rain"
  cacheTimer: null,
  charts: {}            // Store chart instances
};

// --- Rain Standard Levels (Taiwan CWA definitions) ---
const RAIN_LEVELS = [
  { label: "無雨 (0 mm)", min: 0, max: 0.1, color: "#4b5563" },
  { label: "微量 (0.1-40 mm)", min: 0.1, max: 40, color: "#3b82f6" },
  { label: "大雨 (>= 40mm/h 或 24h >= 80mm)", min: 40, max: 200, color: "#eab308" },
  { label: "豪雨 (24h >= 200mm 或 3h >= 100mm)", min: 200, max: 350, color: "#f97316" },
  { label: "大豪雨 (24h >= 350mm)", min: 350, max: 500, color: "#ef4444" },
  { label: "超大豪雨 (24h >= 500mm)", min: 500, max: Infinity, color: "#c084fc" }
];

// --- Temperature Ranges for Visual Mapping ---
const TEMP_LEVELS = [
  { label: "寒冷 (< 10°C)", min: -Infinity, max: 10, color: "#3b82f6" },
  { label: "涼爽 (10-18°C)", min: 10, max: 18, color: "#00e5ff" },
  { label: "舒適 (18-24°C)", min: 18, max: 24, color: "#10b981" },
  { label: "溫暖 (24-30°C)", min: 24, max: 30, color: "#eab308" },
  { label: "炎熱 (30-35°C)", min: 30, max: 35, color: "#f97316" },
  { label: "酷熱 (>= 35°C)", min: 35, max: Infinity, color: "#ef4444" }
];

// --- Leaflet Map Instance ---
let map;
let stationMarkersGroup;

// --- Demo Mock Data ---
// Detailed and geographically accurate coordinates for 24 stations in Taiwan to showcase features beautifully.
// Includes high-altitude stations like Yushan to show clear temperature correlation!
const DEMO_WEATHER_DATA = [
  {
    StationId: "466920", StationName: "臺北", StationLatitude: 25.0377, StationLongitude: 121.5149, StationAltitude: 5.3,
    CountyName: "臺北市", TownName: "中正區", DateTime: new Date().toISOString(),
    AirTemperature: 28.5, RelativeHumidity: 74, WindSpeed: 2.5, WindDirection: 90, Precipitation: 12.5, Weather: "局部陣雨"
  },
  {
    StationId: "C0A980", StationName: "大直", StationLatitude: 25.0838, StationLongitude: 121.5435, StationAltitude: 12.0,
    CountyName: "臺北市", TownName: "中山區", DateTime: new Date().toISOString(),
    AirTemperature: 29.2, RelativeHumidity: 70, WindSpeed: 1.8, WindDirection: 110, Precipitation: 5.0, Weather: "多雲時陰"
  },
  {
    StationId: "C0A9F0", StationName: "內湖", StationLatitude: 25.0792, StationLongitude: 121.5946, StationAltitude: 20.0,
    CountyName: "臺北市", TownName: "內湖區", DateTime: new Date().toISOString(),
    AirTemperature: 28.1, RelativeHumidity: 76, WindSpeed: 2.0, WindDirection: 80, Precipitation: 85.0, Weather: "大雨" // Test Big Rain
  },
  {
    StationId: "466880", StationName: "板橋", StationLatitude: 25.0130, StationLongitude: 121.4420, StationAltitude: 9.7,
    CountyName: "新北市", TownName: "板橋區", DateTime: new Date().toISOString(),
    AirTemperature: 27.8, RelativeHumidity: 78, WindSpeed: 3.2, WindDirection: 95, Precipitation: 48.5, Weather: "陰有雨"
  },
  {
    StationId: "C0I110", StationName: "三峽", StationLatitude: 24.9360, StationLongitude: 121.3734, StationAltitude: 45.0,
    CountyName: "新北市", TownName: "三峽區", DateTime: new Date().toISOString(),
    AirTemperature: 28.0, RelativeHumidity: 81, WindSpeed: 1.1, WindDirection: 60, Precipitation: 210.0, Weather: "豪雨" // Test Extremely Heavy Rain
  },
  {
    StationId: "466900", StationName: "鞍部", StationLatitude: 25.1826, StationLongitude: 121.5297, StationAltitude: 825.8,
    CountyName: "臺北市", TownName: "北投區", DateTime: new Date().toISOString(),
    AirTemperature: 22.1, RelativeHumidity: 98, WindSpeed: 5.8, WindDirection: 75, Precipitation: 120.0, Weather: "濃霧大雨"
  },
  {
    StationId: "466910", StationName: "竹子湖", StationLatitude: 25.1621, StationLongitude: 121.5368, StationAltitude: 607.6,
    CountyName: "臺北市", TownName: "北投區", DateTime: new Date().toISOString(),
    AirTemperature: 23.4, RelativeHumidity: 95, WindSpeed: 4.1, WindDirection: 80, Precipitation: 92.5, Weather: "大雨"
  },
  {
    StationId: "467410", StationName: "臺南", StationLatitude: 22.9932, StationLongitude: 120.2033, StationAltitude: 40.8,
    CountyName: "臺南市", TownName: "中西區", DateTime: new Date().toISOString(),
    AirTemperature: 32.4, RelativeHumidity: 65, WindSpeed: 2.1, WindDirection: 210, Precipitation: 0.0, Weather: "晴天"
  },
  {
    StationId: "467440", StationName: "高雄", StationLatitude: 22.5660, StationLongitude: 120.3090, StationAltitude: 2.3,
    CountyName: "高雄市", TownName: "前鎮區", DateTime: new Date().toISOString(),
    AirTemperature: 33.1, RelativeHumidity: 62, WindSpeed: 4.5, WindDirection: 240, Precipitation: 0.0, Weather: "晴"
  },
  {
    StationId: "467490", StationName: "臺中", StationLatitude: 24.1457, StationLongitude: 120.6843, StationAltitude: 84.0,
    CountyName: "臺中市", TownName: "北區", DateTime: new Date().toISOString(),
    AirTemperature: 31.2, RelativeHumidity: 68, WindSpeed: 2.8, WindDirection: 180, Precipitation: 2.0, Weather: "多雲"
  },
  {
    StationId: "467050", StationName: "新屋", StationLatitude: 24.9658, StationLongitude: 121.0315, StationAltitude: 20.6,
    CountyName: "桃園市", TownName: "新屋區", DateTime: new Date().toISOString(),
    AirTemperature: 29.5, RelativeHumidity: 72, WindSpeed: 4.9, WindDirection: 85, Precipitation: 0.0, Weather: "晴時多雲"
  },
  {
    StationId: "467570", StationName: "新竹", StationLatitude: 24.8279, StationLongitude: 120.9754, StationAltitude: 26.9,
    CountyName: "新竹市", TownName: "香山區", DateTime: new Date().toISOString(),
    AirTemperature: 30.1, RelativeHumidity: 70, WindSpeed: 3.5, WindDirection: 90, Precipitation: 0.0, Weather: "晴"
  },
  {
    StationId: "467650", StationName: "日月潭", StationLatitude: 23.8813, StationLongitude: 120.9081, StationAltitude: 1017.5,
    CountyName: "南投縣", TownName: "魚池鄉", DateTime: new Date().toISOString(),
    AirTemperature: 21.8, RelativeHumidity: 88, WindSpeed: 1.5, WindDirection: 120, Precipitation: 18.0, Weather: "陰天陣雨"
  },
  {
    StationId: "467550", StationName: "玉山", StationLatitude: 23.4876, StationLongitude: 120.9595, StationAltitude: 3844.8,
    CountyName: "南投縣", TownName: "信義鄉", DateTime: new Date().toISOString(),
    AirTemperature: 6.2, RelativeHumidity: 99, WindSpeed: 12.4, WindDirection: 280, Precipitation: 65.5, Weather: "小雨霧" // High altitude, cold!
  },
  {
    StationId: "467530", StationName: "阿里山", StationLatitude: 23.5082, StationLongitude: 120.8130, StationAltitude: 2201.3,
    CountyName: "嘉義縣", TownName: "阿里山鄉", DateTime: new Date().toISOString(),
    AirTemperature: 14.5, RelativeHumidity: 95, WindSpeed: 2.2, WindDirection: 230, Precipitation: 360.0, Weather: "大豪雨" // Torrential rain!
  },
  {
    StationId: "467660", StationName: "臺東", StationLatitude: 22.7522, StationLongitude: 121.1546, StationAltitude: 9.0,
    CountyName: "臺東縣", TownName: "臺東市", DateTime: new Date().toISOString(),
    AirTemperature: 31.8, RelativeHumidity: 63, WindSpeed: 5.1, WindDirection: 160, Precipitation: 0.0, Weather: "晴天"
  },
  {
    StationId: "466990", StationName: "花蓮", StationLatitude: 23.9751, StationLongitude: 121.6133, StationAltitude: 16.1,
    CountyName: "花蓮縣", TownName: "花蓮市", DateTime: new Date().toISOString(),
    AirTemperature: 29.8, RelativeHumidity: 70, WindSpeed: 3.1, WindDirection: 140, Precipitation: 3.5, Weather: "多雲"
  },
  {
    StationId: "467080", StationName: "宜蘭", StationLatitude: 24.7640, StationLongitude: 121.7565, StationAltitude: 7.2,
    CountyName: "宜蘭縣", TownName: "宜蘭市", DateTime: new Date().toISOString(),
    AirTemperature: 28.2, RelativeHumidity: 76, WindSpeed: 2.4, WindDirection: 90, Precipitation: 15.0, Weather: "短暫雨"
  },
  {
    StationId: "466940", StationName: "基隆", StationLatitude: 25.1333, StationLongitude: 121.7408, StationAltitude: 26.7,
    CountyName: "基隆市", TownName: "仁愛區", DateTime: new Date().toISOString(),
    AirTemperature: 28.5, RelativeHumidity: 74, WindSpeed: 5.2, WindDirection: 70, Precipitation: 32.0, Weather: "陰陣雨"
  },
  {
    StationId: "467300", StationName: "澎湖", StationLatitude: 23.5654, StationLongitude: 119.5631, StationAltitude: 10.7,
    CountyName: "澎湖縣", TownName: "馬公市", DateTime: new Date().toISOString(),
    AirTemperature: 30.5, RelativeHumidity: 75, WindSpeed: 7.5, WindDirection: 220, Precipitation: 0.0, Weather: "晴"
  },
  {
    StationId: "467110", StationName: "金門", StationLatitude: 24.4485, StationLongitude: 118.2891, StationAltitude: 48.0,
    CountyName: "金門縣", TownName: "金湖鎮", DateTime: new Date().toISOString(),
    AirTemperature: 27.5, RelativeHumidity: 85, WindSpeed: 4.8, WindDirection: 180, Precipitation: 520.0, Weather: "超大豪雨" // Extreme Torrential!
  },
  {
    StationId: "467990", StationName: "馬祖", StationLatitude: 26.1691, StationLongitude: 119.9228, StationAltitude: 97.8,
    CountyName: "連江縣", TownName: "南竿鄉", DateTime: new Date().toISOString(),
    AirTemperature: 25.8, RelativeHumidity: 92, WindSpeed: 6.2, WindDirection: 190, Precipitation: 95.0, Weather: "大雨雷擊"
  },
  {
    StationId: "C0K400", StationName: "恆春", StationLatitude: 22.0039, StationLongitude: 120.7463, StationAltitude: 22.3,
    CountyName: "屏東縣", TownName: "恆春鎮", DateTime: new Date().toISOString(),
    AirTemperature: 32.9, RelativeHumidity: 68, WindSpeed: 6.8, WindDirection: 250, Precipitation: 0.0, Weather: "晴"
  },
  {
    StationId: "C0G650", StationName: "員林", StationLatitude: 23.9589, StationLongitude: 120.5739, StationAltitude: 32.0,
    CountyName: "彰化縣", TownName: "員林市", DateTime: new Date().toISOString(),
    AirTemperature: 30.8, RelativeHumidity: 70, WindSpeed: 2.1, WindDirection: 160, Precipitation: 1.5, Weather: "多雲"
  }
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
  // Center Taiwan geographically
  map = L.map("map", {
    zoomControl: true,
    minZoom: 7,
    maxZoom: 15
  }).setView([23.8, 121.0], 8);

  // Add CartoDB Dark Matter map tiles (looks very premium and contrasty)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd"
  }).addTo(map);

  stationMarkersGroup = L.layerGroup().addTo(map);
}

// --- Bind Event Listeners ---
function bindEvents() {
  // Modal toggle
  const modal = document.getElementById("api-modal");
  document.getElementById("btn-config-api").addEventListener("click", () => {
    modal.classList.add("open");
  });
  document.getElementById("modal-close").addEventListener("click", () => {
    modal.classList.remove("open");
  });
  
  // Password Visibility Toggle
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

  // Save API Key
  document.getElementById("btn-save-api").addEventListener("click", () => {
    const val = document.getElementById("api-key-input").value.trim();
    if (val) {
      localStorage.setItem(API_KEY_KEY, val);
      state.apiKey = val;
      state.mode = "api";
      // Clear cache to trigger fresh pull
      localStorage.removeItem(CACHE_KEY);
      modal.classList.remove("open");
      loadData();
    } else {
      alert("請輸入有效的 API 授權碼。或是點選下方「切換至 Demo 模式」。");
    }
  });

  // Switch to Demo Mode
  document.getElementById("btn-demo-mode").addEventListener("click", () => {
    localStorage.removeItem(API_KEY_KEY);
    localStorage.removeItem(CACHE_KEY);
    state.apiKey = "";
    state.mode = "demo";
    document.getElementById("api-key-input").value = "";
    modal.classList.remove("open");
    loadData();
  });

  // Manual Refresh
  document.getElementById("btn-refresh").addEventListener("click", () => {
    const icon = document.getElementById("icon-refresh");
    icon.classList.add("icon-pulse");
    
    // Clear cache to force load
    localStorage.removeItem(CACHE_KEY);
    loadData().finally(() => {
      setTimeout(() => {
        icon.classList.remove("icon-pulse");
      }, 800);
    });
  });

  // Map layer toggle
  document.getElementById("map-mode-temp").addEventListener("click", (e) => {
    document.getElementById("map-mode-temp").classList.add("active");
    document.getElementById("map-mode-rain").classList.remove("active");
    state.mapMode = "temp";
    renderMapMarkers();
    renderMapLegend();
  });

  document.getElementById("map-mode-rain").addEventListener("click", (e) => {
    document.getElementById("map-mode-rain").classList.add("active");
    document.getElementById("map-mode-temp").classList.remove("active");
    state.mapMode = "rain";
    renderMapMarkers();
    renderMapLegend();
  });

  // Filters & Search
  document.getElementById("select-county").addEventListener("change", (e) => {
    state.selectedCounty = e.target.value;
    filterAndRender();
  });

  document.getElementById("search-station-input").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    filterAndRender();
  });

  // Tabs for ECharts
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
      
      // ECharts needs resize/update when tab becomes active
      setTimeout(() => {
        Object.values(state.charts).forEach(chart => {
          if (chart) chart.resize();
        });
      }, 50);
    });
  });

  // Handle Window Resize for charts
  window.addEventListener("resize", () => {
    Object.values(state.charts).forEach(chart => {
      if (chart) chart.resize();
    });
  });
}

// --- Data Fetching, Cache & Cleaning ---
async function loadData() {
  updateHeaderUI();
  
  if (state.mode === "demo") {
    state.weatherData = JSON.parse(JSON.stringify(DEMO_WEATHER_DATA)); // Clone mock
    filterAndRender();
    startCacheCountdown(null);
    return;
  }
  
  // Mode: API. Check localStorage cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const cacheObj = JSON.parse(cached);
      const elapsed = Date.now() - cacheObj.timestamp;
      if (elapsed < CACHE_TTL_MS) {
        state.weatherData = cacheObj.data;
        filterAndRender();
        startCacheCountdown(cacheObj.timestamp);
        return;
      }
    } catch (e) {
      console.error("解析快取失敗，將重新拉取 API", e);
    }
  }

  // Fetch from remote RESTful CWA API
  try {
    const response = await fetch(`${CWA_API_URL}?Authorization=${state.apiKey}&format=JSON`);
    if (!response.ok) {
      throw new Error(`API 回傳錯誤代碼: ${response.status}`);
    }
    const rawData = await response.json();
    
    if (rawData.success !== "true" || !rawData.records || !rawData.records.Station) {
      throw new Error("API 回傳結構異常，或金鑰無效！");
    }
    
    // Clean and Structure Data
    state.weatherData = cleanCWAData(rawData.records.Station);
    
    // Save to Cache
    const cacheObj = {
      timestamp: Date.now(),
      data: state.weatherData
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    
    filterAndRender();
    startCacheCountdown(cacheObj.timestamp);
  } catch (error) {
    console.error("獲取 CWA API 資料失敗:", error);
    alert(`獲取 CWA 氣象資料失敗: ${error.message}\n系統將自動切換為 Demo 模擬資料供您測試。`);
    state.mode = "demo";
    state.weatherData = JSON.parse(JSON.stringify(DEMO_WEATHER_DATA));
    filterAndRender();
    startCacheCountdown(null);
  }
}

// --- Data Cleaner ---
function cleanCWAData(stations) {
  const cleanedList = [];
  
  stations.forEach(st => {
    // 1. Core coordinates & location checks
    const lat = parseFloat(st.StationLatitude || (st.GeoInfo && st.GeoInfo.Coordinates && st.GeoInfo.Coordinates[0] && st.GeoInfo.Coordinates[0].StationLatitude));
    const lon = parseFloat(st.StationLongitude || (st.GeoInfo && st.GeoInfo.Coordinates && st.GeoInfo.Coordinates[0] && st.GeoInfo.Coordinates[0].StationLongitude));
    
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return; // Skip coordinates missing

    // 2. Altitude check
    let alt = parseFloat(st.StationAltitude || (st.GeoInfo && st.GeoInfo.StationAltitude));
    if (isNaN(alt) || alt < -100) alt = 0; // standard fallback
    
    // 3. County and Town (CWA structures varies slightly across versions)
    const county = st.CountyName || (st.GeoInfo && st.GeoInfo.CountyName) || "未知縣市";
    const town = st.TownName || (st.GeoInfo && st.GeoInfo.TownName) || "";
    
    // 4. Extract Weather Elements and filter missing/maintenance sentinel values (-99, -990, -999)
    const elem = st.WeatherElement || {};
    
    let temp = parseFloat(elem.AirTemperature);
    if (isNaN(temp) || temp < -90 || temp > 60) temp = null; // Clean -99.0
    
    let hum = parseFloat(elem.RelativeHumidity);
    if (isNaN(hum) || hum < 0 || hum > 100) hum = null; // Clean -99
    
    let windSpd = parseFloat(elem.WindSpeed);
    if (isNaN(windSpd) || windSpd < 0) windSpd = null; // Clean -99
    
    let windDir = parseFloat(elem.WindDirection);
    if (isNaN(windDir) || windDir < 0 || windDir > 360) windDir = null; // Clean -99
    
    let precip = parseFloat(elem.Precipitation || (elem.Now && elem.Now.Precipitation));
    if (isNaN(precip) || precip < -90) precip = null; // Clean -99.0 sentinel value
    else if (precip < 0) precip = 0; // Negative rain correction
    
    const weatherText = elem.Weather || "無狀態數據";
    const dt = st.ObsTime ? st.ObsTime.DateTime : new Date().toISOString();

    cleanedList.push({
      StationId: st.StationId,
      StationName: st.StationName,
      StationLatitude: lat,
      StationLongitude: lon,
      StationAltitude: alt,
      CountyName: county.trim(),
      TownName: town.trim(),
      DateTime: dt,
      AirTemperature: temp,
      RelativeHumidity: hum,
      WindSpeed: windSpd,
      WindDirection: windDir,
      Precipitation: precip,
      Weather: weatherText
    });
  });
  
  return cleanedList;
}

// --- Cache Timer & Countdown ---
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
      const paddedSeconds = seconds.toString().padStart(2, "0");
      cacheText.textContent = `快取中 (剩餘 ${minutes}:${paddedSeconds})`;
    }
  }
  
  updateCountdown();
  state.cacheTimer = setInterval(updateCountdown, 1000);
}

// --- UI Header state updates ---
function updateHeaderUI() {
  const indicator = document.getElementById("mode-indicator");
  const modeText = document.getElementById("status-mode-text");
  
  if (state.mode === "demo") {
    indicator.className = "status-indicator demo";
    modeText.textContent = "Demo 模擬數據模式";
  } else {
    indicator.className = "status-indicator active";
    modeText.textContent = "CWA 即時串接模式";
  }
}

// --- Filter logic ---
function filterAndRender() {
  state.filteredData = state.weatherData.filter(st => {
    // County match
    let countyMatch = true;
    if (state.selectedCounty !== "all") {
      countyMatch = st.CountyName.includes(state.selectedCounty) || 
                    state.selectedCounty.includes(st.CountyName);
    }
    
    // Search match
    let searchMatch = true;
    if (state.searchQuery) {
      searchMatch = st.StationName.toLowerCase().includes(state.searchQuery) ||
                    st.CountyName.toLowerCase().includes(state.searchQuery) ||
                    st.TownName.toLowerCase().includes(state.searchQuery) ||
                    st.StationId.toLowerCase().includes(state.searchQuery);
    }
    
    return countyMatch && searchMatch;
  });

  // Update KPI Metrics Cards (calculated from full cleaned list for accuracy, or filtered if preferred. We use full list for overview, which makes more sense!)
  updateKPIMetrics();
  
  // Render Map Markers
  renderMapMarkers();
  renderMapLegend();
  
  // Render/Update ECharts
  renderCharts();
}

// --- KPI Cards Calculation ---
function updateKPIMetrics() {
  const validTempStations = state.weatherData.filter(st => st.AirTemperature !== null);
  const validRainStations = state.weatherData.filter(st => st.Precipitation !== null);
  
  // 1. Max Temp
  if (validTempStations.length > 0) {
    const maxTempSt = validTempStations.reduce((prev, curr) => prev.AirTemperature > curr.AirTemperature ? prev : curr);
    document.getElementById("val-max-temp").textContent = `${maxTempSt.AirTemperature.toFixed(1)} °C`;
    document.getElementById("loc-max-temp").textContent = `測站: ${maxTempSt.StationName} (${maxTempSt.CountyName})`;
  } else {
    document.getElementById("val-max-temp").textContent = "--.- °C";
    document.getElementById("loc-max-temp").textContent = "無資料";
  }

  // 2. Min Temp
  if (validTempStations.length > 0) {
    const minTempSt = validTempStations.reduce((prev, curr) => prev.AirTemperature < curr.AirTemperature ? prev : curr);
    document.getElementById("val-min-temp").textContent = `${minTempSt.AirTemperature.toFixed(1)} °C`;
    document.getElementById("loc-min-temp").textContent = `測站: ${minTempSt.StationName} (${minTempSt.CountyName})`;
  } else {
    document.getElementById("val-min-temp").textContent = "--.- °C";
    document.getElementById("loc-min-temp").textContent = "無資料";
  }

  // 3. Max Rain
  if (validRainStations.length > 0) {
    const maxRainSt = validRainStations.reduce((prev, curr) => prev.Precipitation > curr.Precipitation ? prev : curr);
    document.getElementById("val-max-rain").textContent = `${maxRainSt.Precipitation.toFixed(1)} mm`;
    document.getElementById("loc-max-rain").textContent = `測站: ${maxRainSt.StationName} (${maxRainSt.CountyName})`;
  } else {
    document.getElementById("val-max-rain").textContent = "0.0 mm";
    document.getElementById("loc-max-rain").textContent = "無降雨測站";
  }

  // 4. Station Counts
  document.getElementById("val-station-count").textContent = state.weatherData.length;
  document.getElementById("lbl-station-detail").textContent = `篩選後: ${state.filteredData.length} 站`;
}

// --- Map Markers Renderer ---
function renderMapMarkers() {
  // Clear old markers
  stationMarkersGroup.clearLayers();
  
  if (state.filteredData.length === 0) return;
  
  // Store bounds to adjust map view slightly if filter is single county
  const latLons = [];
  
  state.filteredData.forEach(st => {
    const lat = st.StationLatitude;
    const lon = st.StationLongitude;
    latLons.push([lat, lon]);

    let markerColor = "#4b5563";
    let tooltipVal = "";
    
    // Choose marker color depending on Map Mode
    if (state.mapMode === "temp") {
      if (st.AirTemperature !== null) {
        const temp = st.AirTemperature;
        const matchedLevel = TEMP_LEVELS.find(lvl => temp >= lvl.min && temp < lvl.max);
        markerColor = matchedLevel ? matchedLevel.color : "#4b5563";
        tooltipVal = `${temp.toFixed(1)} °C`;
      } else {
        tooltipVal = "無資料";
      }
    } else {
      // Rain Mode
      const rain = st.Precipitation;
      const matchedLevel = RAIN_LEVELS.find(lvl => rain >= lvl.min && rain < lvl.max);
      markerColor = matchedLevel ? matchedLevel.color : "#4b5563";
      tooltipVal = `${rain.toFixed(1)} mm`;
    }

    // Creating beautiful custom styled markers using SVG DivIcons (clean, scaling, futuristic)
    const customIcon = L.divIcon({
      className: "custom-marker-icon",
      html: `<div style="
        width: 16px; 
        height: 16px; 
        background-color: ${markerColor}; 
        border: 2.5px solid #fff; 
        border-radius: 50%; 
        box-shadow: 0 0 10px ${markerColor};
        transform: scale(${st.Precipitation > 100 && state.mapMode === "rain" ? 1.4 : 1});
        transition: all 0.3s ease;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    // Create Leaflet Marker
    const marker = L.marker([lat, lon], { icon: customIcon });
    
    // Generate beautiful custom Popup HTML
    const formattedTemp = st.AirTemperature !== null ? `${st.AirTemperature.toFixed(1)} °C` : "保養維修中";
    const formattedHum = st.RelativeHumidity !== null ? `${st.RelativeHumidity.toFixed(0)} %` : "無觀測";
    const formattedWindSpd = st.WindSpeed !== null ? `${st.WindSpeed.toFixed(1)} m/s` : "無";
    const formattedWindDir = st.WindDirection !== null ? `${st.WindDirection}°` : "無";
    
    let rainAlertClass = "";
    let rainAlertText = "正常 / 無警戒";
    if (st.Precipitation >= 500) {
      rainAlertText = "🔴 超大豪雨警戒";
      rainAlertClass = "background: rgba(192, 132, 252, 0.2); color: #c084fc; border: 1px solid #c084fc;";
    } else if (st.Precipitation >= 350) {
      rainAlertText = "🔴 大豪雨警戒";
      rainAlertClass = "background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;";
    } else if (st.Precipitation >= 200) {
      rainAlertText = "🟠 豪雨警戒";
      rainAlertClass = "background: rgba(249, 115, 22, 0.2); color: #f97316; border: 1px solid #f97316;";
    } else if (st.Precipitation >= 80 || st.Precipitation >= 40) {
      // simplified hour rain representation
      rainAlertText = "🟡 大雨特報";
      rainAlertClass = "background: rgba(234, 179, 8, 0.2); color: #eab308; border: 1px solid #eab308;";
    } else if (st.Precipitation > 0) {
      rainAlertText = "🟢 降雨進行中";
      rainAlertClass = "background: rgba(16, 185, 129, 0.15); color: #10b981;";
    }
    
    const popupContent = `
      <div class="popup-station-header">
        <div class="popup-station-name">${st.StationName}</div>
        <div class="popup-station-meta">${st.CountyName} ${st.TownName} | ID: ${st.StationId}</div>
      </div>
      <div class="popup-grid">
        <div class="popup-item">
          <span class="popup-label">即時氣溫</span>
          <span class="popup-val" style="color: ${st.AirTemperature !== null ? '#ffedd5' : '#6b7280'}">${formattedTemp}</span>
        </div>
        <div class="popup-item">
          <span class="popup-label">累積雨量</span>
          <span class="popup-val" style="color: #60a5fa">${st.Precipitation.toFixed(1)} mm</span>
        </div>
        <div class="popup-item">
          <span class="popup-label">相對濕度</span>
          <span class="popup-val">${formattedHum}</span>
        </div>
        <div class="popup-item">
          <span class="popup-label">風向風速</span>
          <span class="popup-val" style="font-size: 0.8rem;">${formattedWindSpd} (${formattedWindDir})</span>
        </div>
      </div>
      <div class="popup-grid">
        <div class="popup-item" style="grid-column: span 2;">
          <span class="popup-label">測站海拔高度</span>
          <span class="popup-val" style="font-size: 0.8rem; color: #a7f3d0;">${st.StationAltitude.toFixed(1)} 公尺 (m)</span>
        </div>
      </div>
      <div class="popup-rain-alert" style="${rainAlertClass || 'background: rgba(255, 255, 255, 0.05); color: var(--text-secondary);'}">
        ${rainAlertText}
      </div>
    `;

    marker.bindPopup(popupContent);
    
    // Add lightweight tooltips for instant mouse-over reading
    marker.bindTooltip(`${st.StationName}: ${tooltipVal}`, {
      direction: "top",
      offset: [0, -10],
      opacity: 0.85
    });

    stationMarkersGroup.addLayer(marker);
  });
  
  // Auto zoom map to selected county if we filter down
  if (state.selectedCounty !== "all" && latLons.length > 0) {
    const bounds = L.latLngBounds(latLons);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
  } else if (state.selectedCounty === "all") {
    // Reset view to Taiwan overview if zoomed-in
    if (map.getZoom() > 9) {
      map.setView([23.8, 121.0], 8);
    }
  }
}

// --- Map Legend Populator ---
function renderMapLegend() {
  const title = document.getElementById("legend-title");
  const container = document.getElementById("legend-items");
  container.innerHTML = "";
  
  if (state.mapMode === "temp") {
    title.textContent = "即時氣溫 (°C)";
    TEMP_LEVELS.forEach(lvl => {
      const item = document.createElement("div");
      item.className = "legend-item";
      
      let valText = "";
      if (lvl.min === -Infinity) valText = `< ${lvl.max}°`;
      else if (lvl.max === Infinity) valText = `> ${lvl.min}°`;
      else valText = `${lvl.min}-${lvl.max}°`;
      
      item.innerHTML = `
        <span class="legend-color" style="background-color: ${lvl.color}"></span>
        <span>${lvl.label.split(" ")[0]} (${valText})</span>
      `;
      container.appendChild(item);
    });
  } else {
    title.textContent = "當日累積雨量 (mm)";
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

// --- ECharts Visualizations Renderer ---
function renderCharts() {
  initRankingCharts();
  initScatterChart();
  initCountyChart();
}

// --- Rankings Tab ---
function initRankingCharts() {
  const textStyle = { color: "#9ca3af", fontFamily: "Outfit, Noto Sans TC, sans-serif" };

  // 1. Rain Rankings (Highest 10)
  const validRainList = [...state.filteredData]
    .filter(st => st.Precipitation !== null)
    .sort((a, b) => b.Precipitation - a.Precipitation)
    .slice(0, 10)
    .reverse(); // reverse for horizontal chart alignment

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
        data: validRainList.map(st => st.StationName),
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
              { offset: 0, color: "#10b981" },
              { offset: 0.7, color: "#3b82f6" },
              { offset: 1, color: "#8b5cf6" }
            ]),
            borderRadius: [0, 4, 4, 0]
          },
          barWidth: "50%"
        }
      ]
    };
    state.charts.rainRank.setOption(option);
  }

  // 2. Temperature Rankings (Highest 10)
  const validTempList = [...state.filteredData]
    .filter(st => st.AirTemperature !== null)
    .sort((a, b) => b.AirTemperature - a.AirTemperature)
    .slice(0, 10)
    .reverse();

  const tempChartDom = document.getElementById("chart-temp-ranking");
  if (tempChartDom) {
    if (!state.charts.tempRank) {
      state.charts.tempRank = echarts.init(tempChartDom);
    }
    
    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: "{b}: {c} °C"
      },
      grid: { left: "4%", right: "8%", bottom: "3%", top: "4%", containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: { textStyle: textStyle }
      },
      yAxis: {
        type: "category",
        data: validTempList.map(st => st.StationName),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { textStyle: textStyle }
      },
      series: [
        {
          name: "即時氣溫",
          type: "bar",
          data: validTempList.map(st => st.AirTemperature),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#eab308" },
              { offset: 0.7, color: "#f97316" },
              { offset: 1, color: "#ef4444" }
            ]),
            borderRadius: [0, 4, 4, 0]
          },
          barWidth: "50%"
        }
      ]
    };
    state.charts.tempRank.setOption(option);
  }
}

// --- Altitude vs Temp Correlation Tab ---
function initScatterChart() {
  const scatterChartDom = document.getElementById("chart-altitude-scatter");
  if (!scatterChartDom) return;

  if (!state.charts.scatter) {
    state.charts.scatter = echarts.init(scatterChartDom);
  }

  const textStyle = { color: "#9ca3af", fontFamily: "Outfit, Noto Sans TC, sans-serif" };
  
  // Format data: [Altitude, Temperature, StationName, CountyName]
  const scatterPoints = state.filteredData
    .filter(st => st.AirTemperature !== null)
    .map(st => [st.StationAltitude, st.AirTemperature, st.StationName, st.CountyName]);

  // Calculate Linear Regression Line (y = mx + b)
  let regressionSeries = [];
  if (scatterPoints.length > 1) {
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = scatterPoints.length;
    
    scatterPoints.forEach(p => {
      sumX += p[0];
      sumY += p[1];
      sumXY += p[0] * p[1];
      sumXX += p[0] * p[0];
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const minAlt = Math.min(...scatterPoints.map(p => p[0]));
    const maxAlt = Math.max(...scatterPoints.map(p => p[0]));
    
    regressionSeries = [
      {
        name: "海拔降溫趨勢線",
        type: "line",
        showSymbol: false,
        data: [
          [minAlt, slope * minAlt + intercept],
          [maxAlt, slope * maxAlt + intercept]
        ],
        lineStyle: {
          color: "#f43f5e",
          width: 2,
          type: "dashed"
        },
        tooltip: { show: false }
      }
    ];
  }

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: function (params) {
        if (params.seriesType === "scatter") {
          return `<div style="font-family: sans-serif; font-size: 0.85rem;">
            <strong>${params.data[2]} (${params.data[3]})</strong><br/>
            海拔高度: ${params.data[0].toFixed(1)} m<br/>
            即時溫度: ${params.data[1].toFixed(1)} °C
          </div>`;
        }
        return "";
      }
    },
    grid: { left: "4%", right: "6%", bottom: "8%", top: "8%", containLabel: true },
    xAxis: {
      name: "海拔高度 (公尺)",
      nameLocation: "center",
      nameGap: 30,
      type: "value",
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      axisLabel: { textStyle: textStyle },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }
    },
    yAxis: {
      name: "即時氣溫 (°C)",
      type: "value",
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      axisLabel: { textStyle: textStyle },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }
    },
    series: [
      {
        name: "測站數據",
        type: "scatter",
        data: scatterPoints,
        symbolSize: function (data) {
          // size of scatter point relates to altitude slightly, but mostly fixed
          return 10;
        },
        itemStyle: {
          color: function (params) {
            const temp = params.data[1];
            const matchedLevel = TEMP_LEVELS.find(lvl => temp >= lvl.min && temp < lvl.max);
            return matchedLevel ? matchedLevel.color : "#4b5563";
          },
          borderColor: "rgba(255, 255, 255, 0.4)",
          borderWidth: 1
        }
      },
      ...regressionSeries
    ]
  };

  state.charts.scatter.setOption(option);
}

// --- County Statistics Distribution Tab ---
function initCountyChart() {
  const countyChartDom = document.getElementById("chart-county-bar");
  if (!countyChartDom) return;

  if (!state.charts.county) {
    state.charts.county = echarts.init(countyChartDom);
  }

  const textStyle = { color: "#9ca3af", fontFamily: "Outfit, Noto Sans TC, sans-serif" };

  // Group and average data by county
  const countyGroup = {};
  state.filteredData.forEach(st => {
    const c = st.CountyName;
    if (!countyGroup[c]) {
      countyGroup[c] = { temps: [], rains: [], count: 0 };
    }
    if (st.AirTemperature !== null) countyGroup[c].temps.push(st.AirTemperature);
    if (st.Precipitation !== null) countyGroup[c].rains.push(st.Precipitation);
    countyGroup[c].count++;
  });

  const counties = Object.keys(countyGroup);
  const avgTemps = [];
  const avgRains = [];

  counties.forEach(c => {
    const data = countyGroup[c];
    const avgT = data.temps.length > 0 ? (data.temps.reduce((s, v) => s + v, 0) / data.temps.length) : null;
    const avgR = data.rains.length > 0 ? (data.rains.reduce((s, v) => s + v, 0) / data.rains.length) : 0;
    
    avgTemps.push(avgT !== null ? parseFloat(avgT.toFixed(1)) : null);
    avgRains.push(parseFloat(avgR.toFixed(1)));
  });

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" }
    },
    legend: {
      data: ["平均累積雨量", "平均溫度"],
      textStyle: textStyle,
      bottom: "0"
    },
    grid: { left: "4%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
    xAxis: [
      {
        type: "category",
        data: counties,
        axisPointer: { type: "shadow" },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { 
          textStyle: textStyle,
          interval: 0,
          rotate: counties.length > 10 ? 35 : 0 
        }
      }
    ],
    yAxis: [
      {
        type: "value",
        name: "降雨量 (mm)",
        min: 0,
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: { textStyle: textStyle, formatter: "{value} mm" }
      },
      {
        type: "value",
        name: "氣溫 (°C)",
        min: 0,
        max: 40,
        splitLine: { show: false },
        axisLabel: { textStyle: textStyle, formatter: "{value} °C" }
      }
    ],
    series: [
      {
        name: "平均累積雨量",
        type: "bar",
        data: avgRains,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#60a5fa" },
            { offset: 1, color: "rgba(96, 165, 250, 0.1)" }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: "平均溫度",
        type: "line",
        yAxisIndex: 1,
        data: avgTemps,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#f43f5e", width: 3 },
        itemStyle: { color: "#f43f5e" }
      }
    ]
  };

  state.charts.county.setOption(option);
}
