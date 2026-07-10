// Aqeel Cabin & Dome Assistant - Frontend JavaScript
// Put this file in GitHub as script.js
// Replace API_URL with your Google Apps Script Web App URL ending in /exec

const API_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

let currentLanguage = "es";
let faqData = [];
let bookedEvents = [];
let currentProperty = "cabin";
let visibleMonth = new Date();

const text = {
  es: {
    heroSubtitle: "Asistente virtual para preguntas frecuentes y disponibilidad",
    propertyTitle: "🏡 Seleccione alojamiento",
    faqTitle: "🤖 Pregunte aquí",
    faqNotice: "Escriba su pregunta. El asistente buscará la respuesta desde nuestra base de datos.",
    blinkPrompt: "👇 Escriba su pregunta aquí / Type your question here 👇",
    faqPlaceholder: "Escriba su pregunta aquí",
    calendarTitle: "📅 Calendario de disponibilidad",
    checkTitle: "📆 Revisar fechas específicas",
    dateNotice: "Use fecha exacta. No escriba “el próximo fin de semana”.",
    arrivalLabel: "📅 Seleccione fecha de llegada",
    checkButton: "Revisar disponibilidad",
    contactTitle: "💬 Contacto",
    noAnswer: "No encontré una respuesta exacta. Por favor escriba su pregunta de otra manera o contáctenos por WhatsApp.",
    chooseDate: "Por favor seleccione una fecha exacta.",
    bookedResult: "Lo sentimos, una o más noches están ocupadas.",
    availableResult: "Buenas noticias. Estas fechas parecen disponibles. Por favor contáctenos por WhatsApp para confirmar el precio.",
    updated: "Última actualización desde Airbnb: ",
    cabinDesc: "Cabaña privada con vista a las montañas, cocina, terraza, hamacas, BBQ y Starlink WiFi.",
    domeDesc: "Domo privado junto al río con cama queen, aire acondicionado, kitchenette, BBQ exterior y naturaleza alrededor."
  },
  en: {
    heroSubtitle: "Virtual assistant for FAQ and availability",
    propertyTitle: "🏡 Choose property",
    faqTitle: "🤖 Ask here",
    faqNotice: "Type your question. The assistant will search our FAQ database.",
    blinkPrompt: "👇 Type your question here / Escriba su pregunta aquí 👇",
    faqPlaceholder: "Type your question here",
    calendarTitle: "📅 Availability calendar",
    checkTitle: "📆 Check specific dates",
    dateNotice: "Use exact dates. Please do not write “next weekend”.",
    arrivalLabel: "📅 Select arrival date",
    checkButton: "Check availability",
    contactTitle: "💬 Contact",
    noAnswer: "I could not find an exact answer. Please ask another way or contact us on WhatsApp.",
    chooseDate: "Please select an exact arrival date.",
    bookedResult: "Sorry, one or more nights are already booked.",
    availableResult: "Good news. These dates appear available. Please contact us on WhatsApp to confirm the price.",
    updated: "Last updated from Airbnb: ",
    cabinDesc: "Private cabin overlooking the mountains with kitchen, terrace, hammocks, BBQ and Starlink WiFi.",
    domeDesc: "Private river dome with queen bed, AC, kitchenette, outdoor BBQ and nature all around."
  }
};

document.addEventListener("DOMContentLoaded", function () {
  setupEvents();
  applyLanguage();
  updatePropertyDisplay();
  loadFAQ();
  loadCalendar();
});

function setupEvents() {
  byId("faqInput")?.addEventListener("input", searchFAQ);
  byId("calendarProperty")?.addEventListener("change", changeProperty);
  byId("checkProperty")?.addEventListener("change", syncPropertySelection);
  byId("checkButton")?.addEventListener("click", checkAvailability);
  byId("prevMonthBtn")?.addEventListener("click", function () {
    visibleMonth.setMonth(visibleMonth.getMonth() - 1);
    renderCalendar();
  });
  byId("nextMonthBtn")?.addEventListener("click", function () {
    visibleMonth.setMonth(visibleMonth.getMonth() + 1);
    renderCalendar();
  });
}

function byId(id) {
  return document.getElementById(id);
}

function setLanguage(lang) {
  currentLanguage = lang;
  applyLanguage();
  searchFAQ();
  renderCalendar();
}

function applyLanguage() {
  const t = text[currentLanguage];

  setText("heroSubtitle", t.heroSubtitle);
  setText("propertyTitle", t.propertyTitle);
  setText("faqTitle", t.faqTitle);
  setText("faqNotice", t.faqNotice);
  setText("blinkPrompt", t.blinkPrompt);
  setText("calendarTitle", t.calendarTitle);
  setText("checkTitle", t.checkTitle);
  setText("dateNotice", t.dateNotice);
  setText("arrivalLabel", t.arrivalLabel);
  setText("checkButton", t.checkButton);
  setText("contactTitle", t.contactTitle);

  const input = byId("faqInput");
  if (input) input.placeholder = t.faqPlaceholder;

  byId("btnSpanish")?.classList.toggle("active-language", currentLanguage === "es");
  byId("btnEnglish")?.classList.toggle("active-language", currentLanguage === "en");

  updatePropertyDisplay();
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.innerText = value;
}

async function loadFAQ() {
  const status = byId("faqStatus");

  try {
    const response = await fetch(API_URL + "?action=faq");
    const data = await response.json();

    faqData = data.faq || [];

    if (status) {
      status.innerText = data.success
        ? "FAQ loaded: " + faqData.length
        : "FAQ error: " + (data.message || "Unknown error");
    }
  } catch (error) {
    if (status) status.innerText = "FAQ connection error. Check API_URL.";
    console.error("FAQ load error:", error);
  }
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchFAQ() {
  const input = byId("faqInput");
  const answerBox = byId("answerBox");
  if (!input || !answerBox) return;

  const question = normalize(input.value);

  if (!question) {
    answerBox.style.display = "none";
    answerBox.innerText = "";
    return;
  }

  let best = null;
  let bestScore = 0;

  for (const item of faqData) {
    const keywordText = normalize(item.spanishKeywords + "," + item.englishKeywords);
    const answerText = normalize(item.spanishAnswer + " " + item.englishAnswer + " " + item.category);
    const keywords = keywordText.split(",").map(k => k.trim()).filter(Boolean);

    let score = 0;

    for (const key of keywords) {
      if (question.includes(key)) score += 5;
      else if (key.includes(question)) score += 3;
      else {
        const words = key.split(" ");
        for (const w of words) {
          if (w.length > 3 && question.includes(w)) score += 1;
        }
      }
    }

    const questionWords = question.split(" ").filter(w => w.length > 3);
    for (const w of questionWords) {
      if (answerText.includes(w)) score += 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  answerBox.style.display = "block";

  if (best && bestScore >= 1) {
    const answer = currentLanguage === "es" ? best.spanishAnswer : best.englishAnswer;
    answerBox.innerText = answer || best.englishAnswer || best.spanishAnswer;
  } else {
    answerBox.innerText = text[currentLanguage].noAnswer;
  }
}

async function loadCalendar() {
  try {
    const response = await fetch(API_URL + "?action=calendar&property=" + currentProperty);
    const data = await response.json();

    bookedEvents = data.events || [];

    const updated = byId("lastUpdated");
    if (updated) updated.innerText = text[currentLanguage].updated + (data.updated || "");

    renderCalendar();
  } catch (error) {
    console.error("Calendar load error:", error);
    const updated = byId("lastUpdated");
    if (updated) updated.innerText = "Calendar connection error. Check API_URL.";
    renderCalendar();
  }
}

function changeProperty() {
  const propertySelect = byId("calendarProperty");
  if (!propertySelect) return;

  currentProperty = propertySelect.value;

  const checkProperty = byId("checkProperty");
  if (checkProperty) checkProperty.value = currentProperty;

  updatePropertyDisplay();
  loadCalendar();
}

function syncPropertySelection() {
  const checkProperty = byId("checkProperty");
  if (!checkProperty) return;

  currentProperty = checkProperty.value;

  const calendarProperty = byId("calendarProperty");
  if (calendarProperty) calendarProperty.value = currentProperty;

  updatePropertyDisplay();
  loadCalendar();
}

function updatePropertyDisplay() {
  const photo = byId("propertyPhoto");
  const name = byId("selectedPropertyName");
  const desc = byId("selectedPropertyDescription");

  if (photo) {
    photo.src = currentProperty === "cabin" ? "cabin.jpg" : "dome.jpg";
    photo.alt = currentProperty === "cabin" ? "Aqeel Cabin" : "Aqeel Dome";
  }

  if (name) name.innerText = currentProperty === "cabin" ? "Aqeel Cabin" : "Aqeel Dome";

  if (desc) {
    desc.innerText = currentProperty === "cabin"
      ? text[currentLanguage].cabinDesc
      : text[currentLanguage].domeDesc;
  }
}

function isBooked(dateString) {
  const date = new Date(dateString + "T00:00:00");

  return bookedEvents.some(function (event) {
    const start = new Date(event.start + "T00:00:00");
    const end = new Date(event.end + "T00:00:00");
    return date >= start && date < end;
  });
}

function renderCalendar() {
  const calendar = byId("calendar");
  const monthTitle = byId("monthTitle");
  if (!calendar) return;

  calendar.innerHTML = "";

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const monthNames = currentLanguage === "es"
    ? ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
    : ["January","February","March","April","May","June","July","August","September","October","November","December"];

  if (monthTitle) {
    monthTitle.innerText = currentLanguage === "es"
      ? `${monthNames[month]} de ${year}`
      : `${monthNames[month]} ${year}`;
  }

  const dayNames = currentLanguage === "es"
    ? ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  dayNames.forEach(function(day) {
    const div = document.createElement("div");
    div.className = "day-name";
    div.innerText = day;
    calendar.appendChild(div);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    calendar.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const div = document.createElement("div");
    div.className = "day " + (isBooked(dateString) ? "booked" : "available");

    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      div.classList.add("today");
    }

    div.innerText = day;
    calendar.appendChild(div);
  }
}

function checkAvailability() {
  const dateInput = byId("checkDate");
  const nightsInput = byId("nights");
  const result = byId("availabilityResult");

  if (!result) return;

  result.style.display = "block";

  if (!dateInput || !dateInput.value) {
    result.innerText = text[currentLanguage].chooseDate;
    return;
  }

  const nights = Math.max(1, Number(nightsInput?.value || 1));

  for (let i = 0; i < nights; i++) {
    const d = new Date(dateInput.value + "T00:00:00");
    d.setDate(d.getDate() + i);

    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (isBooked(dateString)) {
      result.innerText = text[currentLanguage].bookedResult;
      return;
    }
  }

  result.innerText = text[currentLanguage].availableResult;
}
