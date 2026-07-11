// Aqeel Assistant v5 — GitHub Pages frontend
// This URL must end in /exec only.
const API_URL = "https://script.google.com/macros/s/AKfycby0THqdT9zjs8uowwJK_A5BGWEEEgBTSdz7II2Er18kAtHew_J8ceOjRe8qQ3I_tVAM/exec";

let currentLanguage = "es";
let currentProperty = "cabin";
let faqData = [];
let bookedEvents = [];
let visibleMonth = new Date();
let typingTimer = null;
let currentRequestId = 0;
let faqReadyPromise = Promise.resolve();

const AUTO_SEARCH_DELAY_MS = 700;
const MIN_AI_QUESTION_LENGTH = 5;
const FAQ_SCORE_THRESHOLD = 4;

const ui = {
  es: {
    heroSubtitle: "Asistente virtual y disponibilidad",
    languageTitle: "Idioma / Language",
    propertyTitle: "🏡 Seleccione alojamiento",
    faqTitle: "🤖 Pregunte aquí",
    faqNotice: "Primero buscaremos en nuestras preguntas frecuentes. Si no hay una respuesta, el asistente de IA podrá ayudar.",
    faqLabel: "Su pregunta",
    faqPlaceholder: "Ejemplo: ¿Puedo visitar la cabaña solamente durante el día?",
    loadingFaq: "Cargando las preguntas frecuentes…",
    searching: "Buscando en las preguntas frecuentes…",
    thinking: "No encontré una respuesta exacta. Consultando al asistente…",
    databaseSource: "Respuesta de nuestras preguntas frecuentes",
    aiSource: "Respuesta generada con información verificada de la propiedad",
    emptyQuestion: "Por favor, escriba una pregunta.",
    connectionError: "No fue posible obtener una respuesta. Por favor, contáctenos por WhatsApp.",
    calendarTitle: "📅 Calendario de disponibilidad",
    checkTitle: "🗓️ Revisar fechas específicas",
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
    chooseDate: "Por favor, seleccione una fecha exacta.",
    bookedResult: "Lo sentimos, una o más noches aparecen ocupadas.",
    availableResult: "Buenas noticias. Estas fechas parecen disponibles. Contáctenos por WhatsApp para confirmar.",
    cabinDesc: "Cabaña privada con cocina, terraza, hamacas, BBQ y Starlink.",
    domeDesc: "Domo privado junto al río con cama queen, aire acondicionado, cocineta, baño y BBQ.",
    availableDay: "Disponible",
    bookedDay: "Ocupado"
  },
  en: {
    heroSubtitle: "Virtual assistant and availability",
    languageTitle: "Language / Idioma",
    propertyTitle: "🏡 Select accommodation",
    faqTitle: "🤖 Ask here",
    faqNotice: "We search our FAQ first. If no answer is found, the AI assistant can help.",
    faqLabel: "Your question",
    faqPlaceholder: "Example: Can I visit the cabin only during the day?",
    loadingFaq: "Loading frequently asked questions…",
    searching: "Searching the frequently asked questions…",
    thinking: "No exact answer was found. Consulting the assistant…",
    databaseSource: "Answer from our frequently asked questions",
    aiSource: "Answer generated using verified property information",
    emptyQuestion: "Please enter a question.",
    connectionError: "An answer could not be generated. Please contact us on WhatsApp.",
    calendarTitle: "📅 Availability calendar",
    checkTitle: "🗓️ Check specific dates",
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
    availableResult: "Good news. These dates appear available. Contact us on WhatsApp to confirm.",
    cabinDesc: "Private cabin with kitchen, terrace, hammocks, BBQ and Starlink.",
    domeDesc: "Private riverside dome with queen bed, air conditioning, kitchenette, bathroom and BBQ.",
    availableDay: "Available",
    bookedDay: "Booked"
  }
};

document.addEventListener("DOMContentLoaded", function() {
  bindEvents();
  setMinimumDate();
  applyLanguage();
  faqReadyPromise = loadFAQ();
  loadCalendar();
});

function bindEvents() {
  byId("btnSpanish").addEventListener("click", function() {
    setLanguage("es");
  });

  byId("btnEnglish").addEventListener("click", function() {
    setLanguage("en");
  });

  byId("calendarProperty").addEventListener("change", changeProperty);

  byId("faqInput").addEventListener("input", handleTyping);
  byId("faqInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      clearTimeout(typingTimer);
      answerQuestion(true);
    }
  });

  byId("prevMonthBtn").addEventListener("click", function() {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });

  byId("nextMonthBtn").addEventListener("click", function() {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      1
    );
    renderCalendar();
  });

  byId("checkAvailabilityBtn").addEventListener("click", checkAvailability);
}

function handleTyping() {
  clearTimeout(typingTimer);

  const question = byId("faqInput").value.trim();
  const answerBox = byId("answerBox");

  if (question.length < 3) {
    currentRequestId += 1;
    setText("faqStatus", "");
    answerBox.hidden = true;
    return;
  }

  typingTimer = setTimeout(function() {
    answerQuestion(false);
  }, AUTO_SEARCH_DELAY_MS);
}

async function loadFAQ() {
  const t = ui[currentLanguage];
  setText("faqStatus", t.loadingFaq);

  try {
    const response = await fetch(API_URL + "?action=faq", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("FAQ HTTP " + response.status);
    }

    const data = await response.json();
    faqData = Array.isArray(data.faq) ? data.faq : [];
    setText("faqStatus", "");
  } catch (error) {
    console.error("FAQ load error:", error);
    faqData = [];
    setText("faqStatus", "");
  }
}

async function answerQuestion(forceNow) {
  const question = byId("faqInput").value.trim();
  const answerBox = byId("answerBox");
  const answerText = byId("answerText");
  const answerSource = byId("answerSource");
  const t = ui[currentLanguage];

  if (question.length < 3) {
    answerBox.hidden = false;
    answerText.textContent = t.emptyQuestion;
    answerSource.textContent = "";
    return;
  }

  const requestId = ++currentRequestId;
  setText("faqStatus", t.searching);

  await faqReadyPromise;

  if (requestId !== currentRequestId) return;

  const match = findBestFaqMatch(question);

  if (match && match.score >= FAQ_SCORE_THRESHOLD) {
    const answer = currentLanguage === "es"
      ? (match.item.spanishAnswer || match.item.englishAnswer)
      : (match.item.englishAnswer || match.item.spanishAnswer);

    answerBox.hidden = false;
    answerText.textContent = answer || t.connectionError;
    answerSource.textContent = t.databaseSource;
    setText("faqStatus", "");
    return;
  }

  if (question.length < MIN_AI_QUESTION_LENGTH && !forceNow) {
    setText("faqStatus", "");
    return;
  }

  setText("faqStatus", t.thinking);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "ask",
        question: question,
        language: currentLanguage,
        property: currentProperty
      })
    });

    if (!response.ok) {
      throw new Error("Assistant HTTP " + response.status);
    }

    const data = await response.json();
    if (requestId !== currentRequestId) return;

    answerBox.hidden = false;
    answerText.textContent = data.answer || data.message || t.connectionError;
    answerSource.textContent = data.success ? t.aiSource : "";
  } catch (error) {
    console.error("Assistant error:", error);
    if (requestId !== currentRequestId) return;

    answerBox.hidden = false;
    answerText.textContent = t.connectionError;
    answerSource.textContent = "";
  } finally {
    if (requestId === currentRequestId) {
      setText("faqStatus", "");
    }
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
      if (normalizedQuestion === key) {
        score += 12;
      } else if (normalizedQuestion.includes(key)) {
        score += 8;
      } else if (
        key.includes(normalizedQuestion) &&
        normalizedQuestion.length >= 5
      ) {
        score += 5;
      }

      const keyWords = significantWords(key);
      const overlap = keyWords.filter(function(word) {
        return questionWords.includes(word);
      }).length;

      score += overlap * 2;
    }

    if (!best || score > best.score) {
      best = { item: item, score: score };
    }
  }

  return best;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value) {
  const stopWords = new Set([
    "a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "in",
    "is", "it", "of", "on", "the", "to", "we", "what", "where", "with",
    "al", "como", "con", "cual", "de", "del", "el", "en", "es", "esta",
    "hay", "la", "las", "los", "para", "por", "puedo", "que", "se", "un", "una"
  ]);

  return normalize(value)
    .split(" ")
    .filter(function(word) {
      return word.length > 2 && !stopWords.has(word);
    });
}

async function loadCalendar() {
  setText("calendarUpdated", "");
  bookedEvents = [];
  renderCalendar();

  try {
    const response = await fetch(
      API_URL + "?action=calendar&property=" + encodeURIComponent(currentProperty),
      { method: "GET", cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Calendar HTTP " + response.status);
    }

    const data = await response.json();
    bookedEvents = Array.isArray(data.events) ? data.events : [];
    renderCalendar();

    if (data.updated) {
      setText(
        "calendarUpdated",
        ui[currentLanguage].updated + formatDateTime(data.updated)
      );
    }
  } catch (error) {
    console.error("Calendar load error:", error);
    bookedEvents = [];
    renderCalendar();
  }
}

function renderCalendar() {
  const grid = byId("calendarGrid");
  const title = byId("calendarMonthTitle");
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  title.textContent = new Intl.DateTimeFormat(
    currentLanguage === "es" ? "es-PA" : "en-CA",
    { month: "long", year: "numeric" }
  ).format(firstDay);

  grid.innerHTML = "";

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    grid.appendChild(empty);
  }

  const todayYMD = localYMD(new Date());

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const ymd = localYMD(date);
    const booked = isDateBooked(ymd);
    const cell = document.createElement("div");

    cell.className = "day";
    if (booked) cell.classList.add("booked");
    if (ymd === todayYMD) cell.classList.add("today");
    if (date < startOfToday()) cell.classList.add("past");

    cell.innerHTML =
      "<span>" + day + "</span>" +
      "<small>" +
      (booked
        ? ui[currentLanguage].bookedDay
        : ui[currentLanguage].availableDay) +
      "</small>";

    grid.appendChild(cell);
  }
}

function isDateBooked(ymd) {
  return bookedEvents.some(function(event) {
    return ymd >= event.start && ymd < event.end;
  });
}

function checkAvailability() {
  const t = ui[currentLanguage];
  const arrival = byId("arrivalDate").value;
  const nights = Math.max(1, Number(byId("nights").value || 1));
  const guests = Math.max(1, Number(byId("guests").value || 1));
  const result = byId("availabilityResult");

  if (!arrival) {
    result.hidden = false;
    result.className = "result-box warning";
    result.textContent = t.chooseDate;
    return;
  }

  let unavailable = false;
  const dates = [];

  for (let i = 0; i < nights; i += 1) {
    const date = addDaysYMD(arrival, i);
    dates.push(date);
    if (isDateBooked(date)) unavailable = true;
  }

  result.hidden = false;
  result.className = "result-box " + (unavailable ? "warning" : "success");
  result.textContent = unavailable ? t.bookedResult : t.availableResult;

  updateWhatsAppLink(arrival, nights, guests, unavailable);
}

function updateWhatsAppLink(arrival, nights, guests, unavailable) {
  const propertyName = currentProperty === "dome" ? "Aqeel Dome" : "Aqeel Cabin";
  const statusText = unavailable
    ? "The website shows that one or more selected nights may be booked."
    : "The website shows that the selected nights may be available.";

  const message = currentLanguage === "es"
    ? [
        "Hola. Estoy interesado en " + propertyName + ".",
        "Fecha de llegada: " + arrival,
        "Número de noches: " + nights,
        "Número de huéspedes: " + guests,
        statusText
      ].join("\n")
    : [
        "Hello. I am interested in " + propertyName + ".",
        "Arrival date: " + arrival,
        "Number of nights: " + nights,
        "Number of guests: " + guests,
        statusText
      ].join("\n");

  byId("whatsappLink").href =
    "https://wa.me/14037008800?text=" + encodeURIComponent(message);
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "es";
  applyLanguage();
  renderCalendar();

  const question = byId("faqInput").value.trim();
  if (question.length >= 3) {
    clearTimeout(typingTimer);
    answerQuestion(false);
  }
}

function applyLanguage() {
  const t = ui[currentLanguage];

  document.documentElement.lang = currentLanguage;
  setText("heroSubtitle", t.heroSubtitle);
  setText("languageTitle", t.languageTitle);
  setText("propertyTitle", t.propertyTitle);
  setText("faqTitle", t.faqTitle);
  setText("faqNotice", t.faqNotice);
  setText("faqLabel", t.faqLabel);
  byId("faqInput").placeholder = t.faqPlaceholder;
  setText("calendarTitle", t.calendarTitle);
  setText("checkTitle", t.checkTitle);
  setText("dateNotice", t.dateNotice);
  setText("arrivalLabel", t.arrivalLabel);
  setText("nightsLabel", t.nightsLabel);
  setText("guestsLabel", t.guestsLabel);
  setText("checkAvailabilityBtn", t.checkButton);
  setText("contactTitle", t.contactTitle);
  setText("availableLegend", t.availableLegend);
  setText("bookedLegend", t.bookedLegend);
  setText("todayLegend", t.todayLegend);

  byId("btnSpanish").classList.toggle("active", currentLanguage === "es");
  byId("btnEnglish").classList.toggle("active", currentLanguage === "en");

  updatePropertyDescription();
}

function changeProperty() {
  currentProperty = byId("calendarProperty").value === "dome" ? "dome" : "cabin";
  visibleMonth = new Date();
  updatePropertyDescription();
  loadCalendar();
}

function updatePropertyDescription() {
  const t = ui[currentLanguage];
  const isDome = currentProperty === "dome";

  setText("selectedPropertyName", isDome ? "Aqeel Dome" : "Aqeel Cabin");
  setText(
    "selectedPropertyDescription",
    isDome ? t.domeDesc : t.cabinDesc
  );
}

function setMinimumDate() {
  byId("arrivalDate").min = localYMD(new Date());
}

function addDaysYMD(ymd, days) {
  const parts = ymd.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return localYMD(date);
}

function localYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(
    currentLanguage === "es" ? "es-PA" : "en-CA",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}
