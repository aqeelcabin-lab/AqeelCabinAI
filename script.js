// Aqeel Assistant v4 — GitHub frontend
// Replace the value below with your deployed Google Apps Script URL ending in /exec.
const API_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

let currentLanguage = "es";
let currentProperty = "cabin";
let faqData = [];
let bookedEvents = [];
let visibleMonth = new Date();
let lastQuestion = "";
let isAsking = false;

const sessionId = getSessionId();

const ui = {
  es: {
    heroSubtitle: "Asistente virtual para preguntas frecuentes y disponibilidad",
    propertyTitle: "🏡 Seleccione alojamiento",
    faqTitle: "🤖 Pregunte aquí",
    faqNotice: "Primero buscaremos en nuestras preguntas frecuentes. Si no hay una respuesta exacta, consultaremos al asistente de IA.",
    faqLabel: "Su pregunta",
    faqPlaceholder: "Ejemplo: ¿Puedo visitar la cabaña solamente durante el día?",
    askButton: "Buscar respuesta",
    searching: "Buscando en las preguntas frecuentes...",
    thinking: "No encontré una respuesta exacta. Consultando al asistente...",
    databaseSource: "Respuesta de nuestras preguntas frecuentes",
    aiSource: "Respuesta generada con información verificada de la propiedad",
    calendarTitle: "📅 Calendario de disponibilidad",
    checkTitle: "📆 Revisar fechas específicas",
    dateNotice: "Seleccione una fecha exacta; no escriba solamente “el próximo fin de semana”.",
    arrivalLabel: "Fecha de llegada",
    nightsLabel: "Número de noches",
    guestsLabel: "Número de huéspedes",
    checkButton: "Revisar disponibilidad",
    contactTitle: "💬 Contacto",
    availableLegend: "Disponible",
    bookedLegend: "Ocupado",
    todayLegend: "Hoy",
    updated: "Última actualización desde Airbnb: ",
    chooseDate: "Por favor seleccione una fecha exacta.",
    bookedResult: "Lo sentimos, una o más noches aparecen ocupadas.",
    availableResult: "Buenas noticias. Estas fechas parecen disponibles. Contáctenos por WhatsApp para confirmar el precio y completar la reserva.",
    emptyQuestion: "Por favor escriba una pregunta.",
    connectionError: "No fue posible conectar con el asistente. Por favor contáctenos por WhatsApp.",
    cabinDesc: "Cabaña privada con cocina, terraza, hamacas, BBQ y Starlink Wi-Fi.",
    domeDesc: "Domo privado junto al río con cama queen, aire acondicionado, kitchenette, BBQ y baño privado."
  },
  en: {
    heroSubtitle: "Virtual assistant for frequently asked questions and availability",
    propertyTitle: "🏡 Choose a property",
    faqTitle: "🤖 Ask here",
    faqNotice: "We will search our FAQ first. If there is no exact answer, we will consult the AI assistant.",
    faqLabel: "Your question",
    faqPlaceholder: "Example: Can I visit the Cabin only during the daytime?",
    askButton: "Find answer",
    searching: "Searching the frequently asked questions...",
    thinking: "No exact answer was found. Consulting the assistant...",
    databaseSource: "Answer from our frequently asked questions",
    aiSource: "Answer generated from verified property information",
    calendarTitle: "📅 Availability calendar",
    checkTitle: "📆 Check specific dates",
    dateNotice: "Select an exact date; please do not write only “next weekend.”",
    arrivalLabel: "Arrival date",
    nightsLabel: "Number of nights",
    guestsLabel: "Number of guests",
    checkButton: "Check availability",
    contactTitle: "💬 Contact",
    availableLegend: "Available",
    bookedLegend: "Booked",
    todayLegend: "Today",
    updated: "Last updated from Airbnb: ",
    chooseDate: "Please select an exact date.",
    bookedResult: "Sorry, one or more nights appear to be booked.",
    availableResult: "Good news. These dates appear available. Contact us on WhatsApp to confirm the price and complete the reservation.",
    emptyQuestion: "Please enter a question.",
    connectionError: "The assistant could not be reached. Please contact us on WhatsApp.",
    cabinDesc: "Private cabin with kitchen, terrace, hammocks, BBQ and Starlink Wi-Fi.",
    domeDesc: "Private river dome with queen bed, air conditioning, kitchenette, BBQ and private bathroom."
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applyLanguage();
  setMinimumDate();
  loadFAQ();
  loadCalendar();
});

function bindEvents() {
  byId("btnSpanish").addEventListener("click", () => setLanguage("es"));
  byId("btnEnglish").addEventListener("click", () => setLanguage("en"));
  byId("calendarProperty").addEventListener("change", changeProperty);
  byId("checkProperty").addEventListener("change", syncPropertySelection);
  byId("askButton").addEventListener("click", answerQuestion);
  byId("faqInput").addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") answerQuestion();
  });
  byId("prevMonthBtn").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  byId("nextMonthBtn").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  byId("checkButton").addEventListener("click", checkAvailability);
}

function byId(id) {
  return document.getElementById(id);
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "es";
  applyLanguage();
  renderCalendar();
  updatePropertyDisplay();
}

function applyLanguage() {
  const t = ui[currentLanguage];
  const ids = [
    "heroSubtitle", "propertyTitle", "faqTitle", "faqNotice", "faqLabel",
    "askButton", "calendarTitle", "checkTitle", "dateNotice", "arrivalLabel",
    "nightsLabel", "guestsLabel", "checkButton", "contactTitle",
    "availableLegend", "bookedLegend", "todayLegend"
  ];
  ids.forEach(id => setText(id, t[id]));

  byId("faqInput").placeholder = t.faqPlaceholder;
  byId("btnSpanish").classList.toggle("active-language", currentLanguage === "es");
  byId("btnEnglish").classList.toggle("active-language", currentLanguage === "en");
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

async function loadFAQ() {
  try {
    const response = await fetch(`${API_URL}?action=faq`);
    const data = await response.json();
    faqData = Array.isArray(data.faq) ? data.faq : [];
    setText("faqStatus", "");
  } catch (error) {
    console.error("FAQ load error:", error);
    faqData = [];
  }
}

async function answerQuestion() {
  if (isAsking) return;

  const question = byId("faqInput").value.trim();
  const answerBox = byId("answerBox");
  const answerSource = byId("answerSource");
  const t = ui[currentLanguage];

  answerSource.textContent = "";
  answerBox.style.display = "block";

  if (question.length < 3) {
    answerBox.textContent = t.emptyQuestion;
    return;
  }

  isAsking = true;
  toggleAskButton(true);
  setText("faqStatus", t.searching);

  try {
    const match = findBestFaqMatch(question);

    if (match && match.score >= 4) {
      const answer = currentLanguage === "es"
        ? (match.item.spanishAnswer || match.item.englishAnswer)
        : (match.item.englishAnswer || match.item.spanishAnswer);

      answerBox.textContent = answer;
      answerSource.textContent = t.databaseSource;
      setText("faqStatus", "");
      return;
    }

    setText("faqStatus", t.thinking);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "ask",
        question,
        language: currentLanguage,
        property: currentProperty,
        sessionId
      })
    });

    const data = await response.json();
    answerBox.textContent = data.answer || data.message || t.connectionError;
    answerSource.textContent = data.success ? t.aiSource : "";
    lastQuestion = question;
    setText("faqStatus", "");
  } catch (error) {
    console.error("Assistant error:", error);
    answerBox.textContent = t.connectionError;
    setText("faqStatus", "");
  } finally {
    isAsking = false;
    toggleAskButton(false);
  }
}

function findBestFaqMatch(question) {
  const normalizedQuestion = normalize(question);
  const questionWords = significantWords(normalizedQuestion);
  let best = null;

  for (const item of faqData) {
    const keywordGroups = [
      ...String(item.spanishKeywords || "").split(","),
      ...String(item.englishKeywords || "").split(",")
    ].map(normalize).filter(Boolean);

    let score = 0;

    for (const key of keywordGroups) {
      if (normalizedQuestion === key) score += 12;
      else if (normalizedQuestion.includes(key)) score += 8;
      else if (key.includes(normalizedQuestion) && normalizedQuestion.length >= 5) score += 5;

      const keyWords = significantWords(key);
      const overlap = keyWords.filter(word => questionWords.includes(word)).length;
      score += overlap * 2;
    }

    if (!best || score > best.score) best = { item, score };
  }

  return best;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value) {
  const stop = new Set(["the","and","for","with","can","could","would","is","are","a","an","to","of","in",
    "el","la","los","las","un","una","y","para","con","puedo","podria","es","son","de","en","que"]);
  return normalize(value).split(" ").filter(word => word.length > 2 && !stop.has(word));
}

function toggleAskButton(disabled) {
  const button = byId("askButton");
  button.disabled = disabled;
  button.setAttribute("aria-busy", disabled ? "true" : "false");
}

async function loadCalendar() {
  setText("lastUpdated", "Loading...");
  try {
    const response = await fetch(`${API_URL}?action=calendar&property=${currentProperty}`);
    const data = await response.json();
    bookedEvents = Array.isArray(data.events) ? data.events : [];
    const date = data.updated ? new Date(data.updated) : null;
    const formatted = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : (data.updated || "");
    setText("lastUpdated", ui[currentLanguage].updated + formatted);
  } catch (error) {
    console.error("Calendar load error:", error);
    bookedEvents = [];
    setText("lastUpdated", "Calendar connection error.");
  }
  renderCalendar();
}

function changeProperty() {
  currentProperty = byId("calendarProperty").value === "dome" ? "dome" : "cabin";
  byId("checkProperty").value = currentProperty;
  updatePropertyDisplay();
  loadCalendar();
}

function syncPropertySelection() {
  currentProperty = byId("checkProperty").value === "dome" ? "dome" : "cabin";
  byId("calendarProperty").value = currentProperty;
  updatePropertyDisplay();
  loadCalendar();
}

function updatePropertyDisplay() {
  setText("selectedPropertyName", currentProperty === "dome" ? "Aqeel Dome" : "Aqeel Cabin");
  setText("selectedPropertyDescription",
    currentProperty === "dome" ? ui[currentLanguage].domeDesc : ui[currentLanguage].cabinDesc
  );
}

function renderCalendar() {
  const calendar = byId("calendar");
  calendar.innerHTML = "";

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const locale = currentLanguage === "es" ? "es-PA" : "en-CA";

  setText("monthTitle", new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month, 1)));

  const weekdays = currentLanguage === "es"
    ? ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  weekdays.forEach(name => {
    const cell = document.createElement("div");
    cell.className = "day-name";
    cell.textContent = name;
    calendar.appendChild(cell);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "day blank";
    calendar.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateString = toDateString(new Date(year, month, day));
    const cell = document.createElement("div");
    cell.className = "day " + (isBooked(dateString) ? "booked" : "available");
    cell.textContent = day;

    if (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    ) cell.classList.add("today");

    calendar.appendChild(cell);
  }
}

function isBooked(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return bookedEvents.some(event => {
    const start = new Date(`${event.start}T00:00:00`);
    const end = new Date(`${event.end}T00:00:00`);
    return date >= start && date < end;
  });
}

function checkAvailability() {
  const dateValue = byId("checkDate").value;
  const nights = Math.min(30, Math.max(1, Number(byId("nights").value || 1)));
  const result = byId("availabilityResult");
  result.style.display = "block";

  if (!dateValue) {
    result.textContent = ui[currentLanguage].chooseDate;
    return;
  }

  for (let offset = 0; offset < nights; offset++) {
    const date = new Date(`${dateValue}T12:00:00`);
    date.setDate(date.getDate() + offset);
    if (isBooked(toDateString(date))) {
      result.textContent = ui[currentLanguage].bookedResult;
      return;
    }
  }

  result.textContent = ui[currentLanguage].availableResult;
}

function toDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function setMinimumDate() {
  byId("checkDate").min = toDateString(new Date());
}

function getSessionId() {
  const key = "aqeelAssistantSession";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(key, value);
  }
  return value;
}
