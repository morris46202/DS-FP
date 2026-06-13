// Civil IoT Taiwan (CIOT) Multi-Dimensional Sensor Data Dashboard
// Uses Vanilla JS, Leaflet for Maps, and Apache ECharts for Graphs

// --- Constants & Config ---
const CACHE_BASE_KEY = "ciot_weather_dashboard_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

// Category Configurations
const CATEGORIES = {
  rain: {
    title: "🌧️ 降雨與氣象",
    unit: "mm",
    valueLabel: "累積雨量",
    alertThreshold: 40.0,
    alertLabel: "大雨警戒 (>= 40mm)",
    apiUrl: "https://sta.colife.org.tw/STA_RainSewer/v1.0/Things?$expand=Locations,Datastreams/Observations($orderby=phenomenonTime%20desc;$top=1)&$top=200",
    levels: [
      { label: "無雨", min: 0, max: 0.1, color: "#4b5563" },
      { label: "微量", min: 0.1, max: 40, color: "#3b82f6" },
      { label: "大雨", min: 40, max: 200, color: "#eab308" },
      { label: "豪雨", min: 200, max: 350, color: "#f97316" },
      { label: "大豪雨", min: 350, max: 500, color: "#ef4444" },
      { label: "超大豪雨", min: 500, max: Infinity, color: "#c084fc" }
    ]
  },
  water: {
    title: "💧 河川水位",
    unit: "m",
    valueLabel: "即時水位",
    alertThreshold: 5.0,
    alertLabel: "水位警戒 (>= 5m)",
    apiUrl: "https://sta.colife.org.tw/STA_WaterResource_v2/v1.0/Things?$expand=Locations,Datastreams/Observations($orderby=phenomenonTime%20desc;$top=1)&$filter=substringof('水位',Datastreams/description) or substringof('Water Level',Datastreams/description)&$top=200",
    levels: [
      { label: "安全水位", min: 0, max: 2, color: "#10b981" },
      { label: "正常水位", min: 2, max: 5, color: "#3b82f6" },
      { label: "警戒水位", min: 5, max: 8, color: "#f97316" },
      { label: "滿水位", min: 8, max: Infinity, color: "#ef4444" }
    ]
  },
  air: {
    title: "🍃 空氣品質",
    unit: "μg/m³",
    valueLabel: "PM2.5 濃度",
    alertThreshold: 35.5,
    alertLabel: "橘色警戒 (>= 35.5)",
    apiUrl: "https://sta.colife.org.tw/STA_AirQuality_v2/v1.0/Things?$expand=Locations,Datastreams/Observations($orderby=phenomenonTime%20desc;$top=1)&$top=200",
    levels: [
      { label: "良好", min: 0, max: 15, color: "#10b981" },
      { label: "普通", min: 15, max: 35, color: "#eab308" },
      { label: "敏感不健康", min: 35, max: 54, color: "#f97316" },
      { label: "不健康", min: 54, max: 150, color: "#ef4444" },
      { label: "危害", min: 150, max: Infinity, color: "#c084fc" }
    ]
  },
  quake: {
    title: "🫨 地震觀測",
    unit: "級",
    valueLabel: "最大震度",
    alertThreshold: 4.0,
    alertLabel: "中震警戒 (>= 4級)",
    apiUrl: "https://sta.colife.org.tw/STA_Earthquake_v2/v1.0/Things?$expand=Locations,Datastreams/Observations($orderby=phenomenonTime%20desc;$top=1)&$top=30",
    levels: [
      { label: "無感", min: 0, max: 1, color: "#4b5563" },
      { label: "微震", min: 1, max: 3, color: "#3b82f6" },
      { label: "弱震", min: 3, max: 5, color: "#eab308" },
      { label: "強震", min: 5, max: 7, color: "#f97316" },
      { label: "劇震", min: 7, max: Infinity, color: "#ef4444" }
    ]
  },
};

const MOCK_STATIONS = [
  { Name: "台北監控中心", County: "臺北市", Lat: 25.0478, Lon: 121.5170 },
  { Name: "板橋監控站", County: "新北市", Lat: 25.0125, Lon: 121.4646 },
  { Name: "桃園監控站", County: "桃園市", Lat: 25.0797, Lon: 121.2342 },
  { Name: "台中監控站", County: "臺中市", Lat: 24.1627, Lon: 120.6406 },
  { Name: "台南監控站", County: "臺南市", Lat: 22.9976, Lon: 120.2006 },
  { Name: "高雄監控站", County: "高雄市", Lat: 22.6204, Lon: 120.2815 },
  { Name: "基隆監控站", County: "基隆市", Lat: 25.1283, Lon: 121.7443 },
  { Name: "新竹監控站", County: "新竹市", Lat: 24.7737, Lon: 121.0116 },
  { Name: "竹北監控站", County: "新竹縣", Lat: 24.8080, Lon: 121.0400 },
  { Name: "苗栗監控站", County: "苗栗縣", Lat: 24.4074, Lon: 120.7620 },
  { Name: "彰化監控站", County: "彰化縣", Lat: 24.0786, Lon: 120.5581 },
  { Name: "南投監控站", County: "南投縣", Lat: 23.8580, Lon: 120.9230 },
  { Name: "雲林監控站", County: "雲林縣", Lat: 23.7088, Lon: 120.5430 },
  { Name: "嘉義監控站", County: "嘉義縣", Lat: 23.5082, Lon: 120.8130 },
  { Name: "嘉義市區站", County: "嘉義市", Lat: 23.4795, Lon: 120.4497 },
  { Name: "屏東監控站", County: "屏東縣", Lat: 21.9426, Lon: 120.7979 },
  { Name: "宜蘭監控站", County: "宜蘭縣", Lat: 24.8290, Lon: 121.7725 },
  { Name: "花蓮監控站", County: "花蓮縣", Lat: 24.0268, Lon: 121.6322 },
  { Name: "台東監控站", County: "臺東縣", Lat: 23.1235, Lon: 121.4116 },
  { Name: "澎湖監控站", County: "澎湖縣", Lat: 23.6508, Lon: 119.5540 }
];

// --- State Management ---
let state = {
  currentCategory: "rain", // "rain", "water", "air", "quake"
  mode: "live",            // "live" or "demo"
  sensorData: [],          // Cleaned sensor data
  filteredData: [],        // Filtered based on filters
  selectedCounty: "all",
  searchQuery: "",
  mapMode: "all",          // "all" or "alert"
  cacheTimer: null,
  charts: {}
};

let map;
let stationMarkersGroup;
let historicalEvents = {};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  await loadHistoricalData();
  initMap();
  bindEvents();
  loadData();
});

async function loadHistoricalData() {
  try {
    const response = await fetch("history_rain_events.json");
    historicalEvents = await response.json();
  } catch (e) {
    console.error("載入歷史資料失敗:", e);
  }
}

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

function bindEvents() {
  const modal = document.getElementById("api-modal");
  
  // Category switch
  const selectCat = document.getElementById("select-category");
  if (selectCat) {
    selectCat.addEventListener("change", (e) => {
      state.currentCategory = e.target.value;
      // Show/hide historical dropdown (only rainfall has historical presets)
      const demoDropdown = document.getElementById("demo-event-container");
      if (demoDropdown) {
        demoDropdown.style.display = (state.currentCategory === "rain" && state.mode === "demo") ? "flex" : "none";
      }
      
      // Update warning label in map filter
      const alertToggle = document.getElementById("map-mode-alert");
      if (alertToggle) {
        alertToggle.textContent = CATEGORIES[state.currentCategory].alertLabel;
      }
      
      loadData();
    });
  }

  const btnConfigApi = document.getElementById("btn-config-api");
  if (btnConfigApi && modal) {
    btnConfigApi.addEventListener("click", () => modal.classList.add("open"));
  }
  
  const modalClose = document.getElementById("modal-close");
  if (modalClose && modal) {
    modalClose.addEventListener("click", () => modal.classList.remove("open"));
  }
  
  const okBtn = document.getElementById("btn-close-modal-ok");
  if (okBtn && modal) {
    okBtn.addEventListener("click", () => modal.classList.remove("open"));
  }
  
  const btnRefresh = document.getElementById("btn-refresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      // Clear cache for current category and reload
      const cacheKey = `${CACHE_BASE_KEY}_${state.currentCategory}`;
      localStorage.removeItem(cacheKey);
      loadData();
    });
  }
  
  const selectCounty = document.getElementById("select-county");
  if (selectCounty) {
    selectCounty.addEventListener("change", (e) => {
      state.selectedCounty = e.target.value;
      filterAndRender();
    });
  }
  
  const searchInput = document.getElementById("search-station-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      filterAndRender();
    });
  }
  
  const mapModeRain = document.getElementById("map-mode-rain");
  const mapModeAlert = document.getElementById("map-mode-alert");
  
  if (mapModeRain && mapModeAlert) {
    mapModeRain.addEventListener("click", () => {
      mapModeRain.classList.add("active");
      mapModeAlert.classList.remove("active");
      state.mapMode = "all";
      filterAndRender();
    });
    
    mapModeAlert.addEventListener("click", () => {
      mapModeAlert.classList.add("active");
      mapModeRain.classList.remove("active");
      state.mapMode = "alert";
      filterAndRender();
    });
  }
  
  const selectDemoEvent = document.getElementById("select-demo-event");
  if (selectDemoEvent) {
    selectDemoEvent.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "current") {
        state.sensorData = generateMockSensorData(state.currentCategory);
      } else if (historicalEvents[val]) {
        // Map precipitation values to our normalized field
        state.sensorData = historicalEvents[val].data.map(d => ({
          StationId: d.StationId,
          StationName: d.StationName,
          StationLatitude: d.StationLatitude,
          StationLongitude: d.StationLongitude,
          CountyName: d.CountyName,
          Value: d.Precipitation
        }));
      }
      filterAndRender();
    });
  }

  // Tab switcher
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const tabId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active");
      });
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add("active");
      
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

function generateMockSensorData(category) {
  const list = [];
  const meta = CATEGORIES[category];
  
  MOCK_STATIONS.forEach((s, idx) => {
    let val = 0;
    
    if (category === "rain") {
      val = [0, 8.5, 35, 62, 210, 480][idx % 6] + (Math.random() * 5);
    } else if (category === "water") {
      val = (idx % 4) * 2.3 + (Math.random() * 1.5);
    } else if (category === "air") {
      val = (idx % 5) * 33 + Math.floor(Math.random() * 12);
    } else if (category === "quake") {
      val = (idx % 6) * 1.2;
    }
    
    list.push({
      StationId: `MOCK_${idx.toString().padStart(3, "0")}`,
      StationName: s.Name,
      StationLatitude: s.Lat,
      StationLongitude: s.Lon,
      CountyName: s.County,
      Value: parseFloat(val.toFixed(1))
    });
  });
  return list;
}

// --- Data Loader ---
async function loadData() {
  updateHeaderUI();
  const meta = CATEGORIES[state.currentCategory];
  
  if (state.mode === "demo") {
    state.sensorData = generateMockSensorData(state.currentCategory);
    filterAndRender();
    startCacheCountdown(null);
    return;
  }
  
  const cacheKey = `${CACHE_BASE_KEY}_${state.currentCategory}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const cacheObj = JSON.parse(cached);
      if (Date.now() - cacheObj.timestamp < CACHE_TTL_MS) {
        state.sensorData = cacheObj.data;
        filterAndRender();
        startCacheCountdown(cacheObj.timestamp);
        return;
      }
    } catch (e) {
      console.error("解析快取失敗", e);
    }
  }

  // Fetch CIOT API
  try {
    const response = await fetch(meta.apiUrl);
    if (!response.ok) {
      throw new Error(`API 連線失敗，HTTP: ${response.status}`);
    }
    const rawData = await response.json();
    if (!rawData.value || !Array.isArray(rawData.value)) {
      throw new Error("無效的 OGC SensorThings 格式");
    }

    state.sensorData = cleanCIOTData(rawData.value, state.currentCategory);
    
    const cacheObj = {
      timestamp: Date.now(),
      data: state.sensorData
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
    
    filterAndRender();
    startCacheCountdown(cacheObj.timestamp);
  } catch (error) {
    console.error("API 載入失敗，切換至模擬資料模式:", error);
    state.mode = "demo";
    updateHeaderUI();
    state.sensorData = generateMockSensorData(state.currentCategory);
    filterAndRender();
    startCacheCountdown(null);
  }
}

// --- Normalization Data Cleaner ---
function cleanCIOTData(things, category) {
  const cleanedList = [];
  
  things.forEach(thing => {
    const loc = thing.Locations && thing.Locations[0] && thing.Locations[0].location;
    const coords = loc && loc.coordinates;
    const lon = coords ? parseFloat(coords[0]) : null;
    const lat = coords ? parseFloat(coords[1]) : null;
    
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return;
    
    let val = null;
    
    if (thing.Datastreams && thing.Datastreams.length > 0) {
      let filterWord = "雨量";
      if (category === "water") filterWord = "水位";
      if (category === "air") filterWord = "PM";
      if (category === "quake") filterWord = "震度";
      
      const matchedDs = thing.Datastreams.find(ds => ds.name && ds.name.includes(filterWord)) || thing.Datastreams[0];
      if (matchedDs && matchedDs.Observations && matchedDs.Observations.length > 0) {
        val = parseFloat(matchedDs.Observations[0].result);
      }
    }
    
    if (isNaN(val) || val < 0) val = null;
    
    const name = (thing.properties && (thing.properties.stationName || thing.properties.stationName)) 
      || (thing.properties && thing.properties.stationID)
      || thing.name 
      || thing.description 
      || "未命名測站";
    let county = "";
    if (thing.properties && thing.properties.county) {
      county = thing.properties.county;
    } else {
      const matches = name.match(/(臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|澎湖縣)/);
      if (matches) county = matches[0];
    }
    
    let finalName = name.replace("下水道雨量計-", "").replace("河川水位計-", "").replace("下水道雨量-", "").replace("水位計-", "").replace("空氣品質測站-", "").replace("空品測站-", "");
    if (finalName.startsWith("未知縣市-") || finalName.startsWith("未知縣市")) {
      finalName = finalName.replace(/^未知縣市-?/, "");
    }
    
    cleanedList.push({
      StationId: thing["@iot.id"] || thing.name,
      StationName: finalName.trim() || "未命名測站",
      StationLatitude: lat,
      StationLongitude: lon,
      CountyName: county.trim(),
      Value: val
    });
  });
  return cleanedList;
}

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
      cacheText.textContent = `快取中 (${minutes}:${seconds.toString().padStart(2, "0")})`;
    }
  }
  updateCountdown();
  state.cacheTimer = setInterval(updateCountdown, 1000);
}

function updateHeaderUI() {
  const indicator = document.getElementById("mode-indicator");
  const modeText = document.getElementById("status-mode-text");
  const demoEventContainer = document.getElementById("demo-event-container");
  
  if (state.mode === "demo") {
    indicator.className = "status-indicator demo";
    modeText.textContent = "Demo 模擬數據模式";
    if (state.currentCategory === "rain" && demoEventContainer) {
      demoEventContainer.style.display = "flex";
    } else if (demoEventContainer) {
      demoEventContainer.style.display = "none";
    }
  } else {
    indicator.className = "status-indicator active";
    modeText.textContent = "CIOT 即時連線模式";
    if (demoEventContainer) demoEventContainer.style.display = "none";
  }
}

function filterAndRender() {
  state.filteredData = state.sensorData.filter(st => {
    let countyMatch = true;
    if (state.selectedCounty !== "all") {
      countyMatch = st.CountyName.includes(state.selectedCounty) || state.selectedCounty.includes(st.CountyName);
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

function updateKPIMetrics() {
  const meta = CATEGORIES[state.currentCategory];
  const validGrids = state.sensorData.filter(st => st.Value !== null);
  
  // Update UI Metric Card titles dynamically
  document.getElementById("lbl-max-title").textContent = `全台最高${meta.valueLabel}`;
  document.getElementById("lbl-avg-title").textContent = `全台平均${meta.valueLabel}`;
  document.getElementById("lbl-alert-title").textContent = `警戒測站數 (${meta.alertLabel})`;
  
  // Calculate max & average
  if (validGrids.length > 0) {
    const maxSt = validGrids.reduce((prev, curr) => prev.Value > curr.Value ? prev : curr);
    document.getElementById("val-max-rain").textContent = `${maxSt.Value.toFixed(1)} ${meta.unit}`;
    document.getElementById("loc-max-rain").textContent = `${maxSt.StationName} (${maxSt.CountyName})`;
    
    const avg = validGrids.reduce((sum, v) => sum + v.Value, 0) / validGrids.length;
    document.getElementById("val-avg-rain").textContent = `${avg.toFixed(1)} ${meta.unit}`;
    document.getElementById("loc-avg-rain").textContent = `全台 ${validGrids.length} 站觀測均值`;
    
    const alertCount = state.sensorData.filter(st => st.Value >= meta.alertThreshold).length;
    document.getElementById("val-alert-count").textContent = alertCount;
    document.getElementById("lbl-alert-detail").textContent = `觀測值高於 ${meta.alertThreshold} ${meta.unit}`;
  } else {
    document.getElementById("val-max-rain").textContent = `-- ${meta.unit}`;
    document.getElementById("loc-max-rain").textContent = "無觀測站點";
    document.getElementById("val-avg-rain").textContent = `-- ${meta.unit}`;
    document.getElementById("loc-avg-rain").textContent = "無觀測站點";
    document.getElementById("val-alert-count").textContent = "0";
    document.getElementById("lbl-alert-detail").textContent = "無警戒站點";
  }
  
  document.getElementById("val-station-count").textContent = state.sensorData.length;
  document.getElementById("lbl-station-detail").textContent = `篩選後餘: ${state.filteredData.length} 站`;
}

function getMarkerColor(val, category) {
  if (val === null || isNaN(val)) return "#4b5563";
  const levels = CATEGORIES[category].levels;
  for (let lvl of levels) {
    if (val >= lvl.min && val < lvl.max) return lvl.color;
  }
  return "#4b5563";
}

function renderMapMarkers() {
  stationMarkersGroup.clearLayers();
  const meta = CATEGORIES[state.currentCategory];
  
  const mapData = state.mapMode === "alert" 
    ? state.filteredData.filter(st => st.Value >= meta.alertThreshold) 
    : state.filteredData;
    
  mapData.forEach(st => {
    const color = getMarkerColor(st.Value, state.currentCategory);
    let valText = `${st.Value} ${meta.unit}`;
    
    const popupHtml = `
      <div class="popup-station-header">
        <div class="popup-station-name">${st.StationName}</div>
        <div class="popup-station-meta">ID: ${st.StationId}</div>
      </div>
      <div class="popup-grid">
        <div class="popup-item">
          <span class="popup-label">縣市</span>
          <span class="popup-val">${st.CountyName}</span>
        </div>
        <div class="popup-item">
          <span class="popup-label">${meta.valueLabel}</span>
          <span class="popup-val" style="color: ${color}; font-weight: bold;">${valText}</span>
        </div>
      </div>
    `;
    
    let radius = 8;
    
    L.circleMarker([st.StationLatitude, st.StationLongitude], {
      radius: radius,
      fillColor: color,
      color: "#ffffff",
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0.85
    }).bindPopup(popupHtml, { maxWidth: 260 }).addTo(stationMarkersGroup);
  });
}

function renderMapLegend() {
  const container = document.getElementById("legend-items");
  const title = document.getElementById("legend-title");
  container.innerHTML = "";
  
  const meta = CATEGORIES[state.currentCategory];
  title.textContent = `${meta.valueLabel} (${meta.unit})`;
  
  meta.levels.forEach(lvl => {
    const item = document.createElement("div");
    item.className = "legend-item";
    
    let valText = "";
    if (lvl.min === 0 && lvl.max === 0.1) valText = `0 ${meta.unit}`;
    else if (lvl.max === Infinity) valText = `> ${lvl.min} ${meta.unit}`;
    else valText = `${lvl.min}-${lvl.max} ${meta.unit}`;
    
    item.innerHTML = `
      <span class="legend-color" style="background-color: ${lvl.color}"></span>
      <span>${lvl.label} (${valText})</span>
    `;
    container.appendChild(item);
  });
}

// --- ECharts plotting ---
function renderCharts() {
  const meta = CATEGORIES[state.currentCategory];
  
  // Section Headers & Titles Update
  document.getElementById("lbl-charts-title").textContent = `${meta.title}統計與分析`;
  document.getElementById("lbl-tab-rankings").textContent = `${meta.valueLabel}排行`;
  document.getElementById("lbl-tab-scatter").textContent = `${meta.valueLabel}區間分布`;
  document.getElementById("lbl-tab-counties").textContent = `縣市${meta.valueLabel}統計`;
  
  document.getElementById("lbl-chart-rank-title").textContent = `即時${meta.valueLabel}排行榜 (Top 15 監測站)`;
  document.getElementById("lbl-chart-hist-title").textContent = `監測${meta.valueLabel}站區間分布統計 (測站個數分佈)`;
  document.getElementById("lbl-chart-county-title").textContent = `各縣市平均${meta.valueLabel}與最大${meta.valueLabel}分佈`;

  const textStyle = { color: "#9ca3af", fontFamily: "Outfit, Noto Sans TC, sans-serif" };

  // 1. Rankings (Highest 15)
  const rankingDom = document.getElementById("chart-rain-ranking");
  if (rankingDom) {
    if (!state.charts.rainRank) state.charts.rainRank = echarts.init(rankingDom);
    
    const topData = [...state.filteredData]
      .filter(st => st.Value !== null)
      .sort((a, b) => b.Value - a.Value)
      .slice(0, 15)
      .reverse();
      
    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: `{b}: {c} ${meta.unit}`
      },
      grid: { left: "4%", right: "8%", bottom: "3%", top: "4%", containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: { textStyle: textStyle }
      },
      yAxis: {
        type: "category",
        data: topData.map(st => `${st.CountyName} - ${st.StationName}`),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { textStyle: textStyle }
      },
      series: [
        {
          name: meta.valueLabel,
          type: "bar",
          data: topData.map(st => st.Value),
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
    state.charts.rainRank.setOption(option, true);
  }

  // 2. Histogram
  const histDom = document.getElementById("chart-rain-histogram");
  if (histDom) {
    if (!state.charts.histogram) state.charts.histogram = echarts.init(histDom);
    
    const bins = {};
    meta.levels.forEach(lvl => bins[lvl.label] = 0);
    
    state.filteredData.forEach(st => {
      if (st.Value === null) return;
      for (let lvl of meta.levels) {
        if (st.Value >= lvl.min && st.Value < lvl.max) {
          bins[lvl.label]++;
          break;
        }
      }
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
              return meta.levels[params.dataIndex]?.color || "#3b82f6";
            },
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: "50%"
        }
      ]
    };
    state.charts.histogram.setOption(option, true);
  }

  // 3. County bar chart
  const countyDom = document.getElementById("chart-county-bar");
  if (countyDom) {
    if (!state.charts.county) state.charts.county = echarts.init(countyDom);
    
    const countyGroup = {};
    state.filteredData.forEach(st => {
      if (st.Value === null) return;
      if (!countyGroup[st.CountyName]) countyGroup[st.CountyName] = [];
      countyGroup[st.CountyName].push(st.Value);
    });
    
    const counties = Object.keys(countyGroup);
    const avgVals = [];
    const maxVals = [];
    
    counties.forEach(c => {
      const list = countyGroup[c];
      const avg = list.length > 0 ? (list.reduce((sum, v) => sum + v, 0) / list.length) : 0;
      const max = list.length > 0 ? Math.max(...list) : 0;
      avgVals.push(parseFloat(avg.toFixed(1)));
      maxVals.push(parseFloat(max.toFixed(1)));
    });
    
    const option = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { data: ["縣市平均值", "縣市最大值"], textStyle: textStyle, bottom: "0" },
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
          name: `${meta.valueLabel} (${meta.unit})`,
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
          axisLabel: { textStyle: textStyle }
        }
      ],
      series: [
        {
          name: "縣市平均值",
          type: "bar",
          data: avgVals,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#3b82f6" },
              { offset: 1, color: "rgba(59, 130, 246, 0.1)" }
            ]),
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: "縣市最大值",
          type: "line",
          data: maxVals,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#f43f5e", width: 2.5 },
          itemStyle: { color: "#f43f5e" }
        }
      ]
    };
    state.charts.county.setOption(option, true);
  }
}
