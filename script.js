// Aqeel Assistant v7 — safer calendar handling and natural FAQ answers
const API_URL = "https://script.google.com/macros/s/AKfycby0THqdT9zjs8uowwJK_A5BGWEEEGgBTSdz7II2Er18kAtHew_J8ce0jRe8qQ3I_tVAM/exec";

let currentLanguage = "es";
let currentProperty = "cabin";
let bookedEvents = [];
let visibleMonth = new Date();
let typingTimer = null;
let currentRequestId = 0;
let calendarReady = false;
let calendarLoading = false;

const AUTO_SEARCH_DELAY_MS = 700;
const REQUEST_TIMEOUT_MS = 15000;

const ui = {
  es: {
    heroSubtitle: "Asistente virtual y disponibilidad",
    languageTitle: "Idioma / Language",
    propertyTitle: "🏡 Seleccione alojamiento",
    faqTitle: "🤖 Pregunte aquí",
    faqNotice: "Usamos información verificada de nuestras preguntas frecuentes y la IA para responder de forma natural.",
    faqLabel: "Su pregunta",
    faqPlaceholder: "Ejemplo: ¿Puedo visitar la cabaña solamente durante el día?",
    searching: "Buscando una respuesta…",
    databaseSource: "Respuesta preparada con información verificada de nuestras preguntas frecuentes",
    aiSource: "Respuesta generada con información verificada de la propiedad",
    emptyQuestion: "Por favor, escriba una pregunta.",
    connectionError: "No fue posible obtener una respuesta. Por favor, contáctenos por WhatsApp.",
    calendarTitle: "📅 Calendario de disponibilidad",
    calendarLoading: "Cargando disponibilidad desde Airbnb…",
    calendarError: "No se pudo cargar la disponibilidad. No asumiremos que las fechas están disponibles. Inténtelo de nuevo o contáctenos por WhatsApp.",
    unknownDay: "Sin datos",
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
    calendarUnavailable: "No podemos revisar estas fechas porque la información de Airbnb no se cargó. Inténtelo de nuevo o contáctenos por WhatsApp.",
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
    faqNotice: "We use verified FAQ information and AI to provide a natural answer.",
    faqLabel: "Your question",
    faqPlaceholder: "Example: Can I visit the cabin only during the day?",
    searching: "Searching for an answer…",
    databaseSource: "Answer prepared using verified FAQ information",
    aiSource: "Answer generated using verified property information",
    emptyQuestion: "Please enter a question.",
    connectionError: "An answer could not be generated. Please contact us on WhatsApp.",
    calendarTitle: "📅 Availability calendar",
    calendarLoading: "Loading availability from Airbnb…",
    calendarError: "Availability could not be loaded. We will not assume the dates are available. Please try again or contact us on WhatsApp.",
    unknownDay: "No data",
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
    calendarUnavailable: "We cannot check these dates because Airbnb availability did not load. Please try again or contact us on WhatsApp.",
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
  loadCalendar();
});

function bindEvents() {
  byId("btnSpanish").addEventListener("click", function() { setLanguage("es"); });
  byId("btnEnglish").addEventListener("click", function() { setLanguage("en"); });
  byId("calendarProperty").addEventListener("change", changeProperty);

  byId("faqInput").addEventListener("input", function() {
    clearTimeout(typingTimer);
    const question = byId("faqInput").value.trim();

    if (question.length < 3) {
      currentRequestId += 1;
      byId("answerBox").hidden = true;
      setText("faqStatus", "");
      return;
    }

    typingTimer = setTimeout(function() {
      askBackend(question);
    }, AUTO_SEARCH_DELAY_MS);
  });

  byId("faqInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      clearTimeout(typingTimer);
      askBackend(byId("faqInput").value.trim());
    }
  });

  byId("prevMonthBtn").addEventListener("click", function() {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  byId("nextMonthBtn").addEventListener("click", function() {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  byId("checkAvailabilityBtn").addEventListener("click", checkAvailability);
  byId("openDatePickerBtn").addEventListener("click", openDatePicker);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs);

  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry(url, options, attempts) {
  let lastError;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetchWithTimeout(url, options, REQUEST_TIMEOUT_MS);
      if (!response.ok) throw new Error("HTTP " + response.status);

      const data = await response.json();
      if (data && data.success === false) {
        throw new Error(data.message || "Request failed.");
      }
      return data;
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise(function(resolve) { setTimeout(resolve, 700); });
      }
    }
  }

  throw lastError;
}

async function askBackend(question) {
  const t = ui[currentLanguage];
  const answerBox = byId("answerBox");

  if (question.length < 3) {
    answerBox.hidden = false;
    setText("answerText", t.emptyQuestion);
    setText("answerSource", "");
    return;
  }

  const requestId = ++currentRequestId;
  setText("faqStatus", t.searching);

  try {
    const data = await fetchJsonWithRetry(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "ask",
        question: question,
        language: currentLanguage,
        property: currentProperty
      })
    }, 2);

    if (requestId !== currentRequestId) return;

    answerBox.hidden = false;
    setText("answerText", data.answer || data.message || t.connectionError);
    setText(
      "answerSource",
      data.source === "faq_ai" ? t.databaseSource :
      data.source === "ai" ? t.aiSource : ""
    );
  } catch (error) {
    console.error("Assistant error:", error);
    if (requestId !== currentRequestId) return;

    answerBox.hidden = false;
    setText("answerText", t.connectionError);
    setText("answerSource", "");
  } finally {
    if (requestId === currentRequestId) setText("faqStatus", "");
  }
}

async function loadCalendar() {
  const t = ui[currentLanguage];
  calendarLoading = true;
  calendarReady = false;
  bookedEvents = [];

  setCalendarStatus(t.calendarLoading, "loading");
  setText("calendarUpdated", "");
  byId("checkAvailabilityBtn").disabled = true;
  renderCalendar();

  try {
    const url = API_URL +
      "?action=calendar&property=" + encodeURIComponent(currentProperty) +
      "&_=" + Date.now();

    const data = await fetchJsonWithRetry(url, {
      method: "GET",
      cache: "no-store"
    }, 2);

    if (!Array.isArray(data.events)) {
      throw new Error("Calendar response did not include events.");
    }

    bookedEvents = data.events;
    calendarReady = true;
    setCalendarStatus("", "");
    byId("checkAvailabilityBtn").disabled = false;

    if (data.updated) {
      setText("calendarUpdated", t.updated + formatDateTime(data.updated));
    }
  } catch (error) {
    console.error("Calendar load error:", error);
    calendarReady = false;
    bookedEvents = [];
    setCalendarStatus(t.calendarError, "error");
    byId("checkAvailabilityBtn").disabled = false;
  } finally {
    calendarLoading = false;
    renderCalendar();
  }
}

function setCalendarStatus(message, className) {
  const element = byId("calendarStatus");
  element.textContent = message;
  element.className = "calendar-status" + (className ? " " + className : "");
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
    const booked = calendarReady && isDateBooked(ymd);
    const cell = document.createElement("div");

    cell.className = "day";
    if (!calendarReady) cell.classList.add("unknown");
    if (booked) cell.classList.add("booked");
    if (ymd === todayYMD) cell.classList.add("today");
    if (date < startOfToday()) cell.classList.add("past");

    let label = ui[currentLanguage].unknownDay;
    if (calendarReady) {
      label = booked ? ui[currentLanguage].bookedDay : ui[currentLanguage].availableDay;
    }

    cell.innerHTML = "<span>" + day + "</span><small>" + label + "</small>";
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

  if (!calendarReady) {
    result.hidden = false;
    result.className = "result-box warning";
    result.textContent = t.calendarUnavailable;
    return;
  }

  if (!arrival) {
    result.hidden = false;
    result.className = "result-box warning";
    result.textContent = t.chooseDate;
    return;
  }

  let unavailable = false;
  for (let i = 0; i < nights; i += 1) {
    if (isDateBooked(addDaysYMD(arrival, i))) unavailable = true;
  }

  result.hidden = false;
  result.className = "result-box " + (unavailable ? "warning" : "success");
  result.textContent = unavailable ? t.bookedResult : t.availableResult;
  updateWhatsAppLink(arrival, nights, guests, unavailable);
}

function openDatePicker() {
  const input = byId("arrivalDate");
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  } catch (error) {
    input.focus();
    input.click();
  }
}

function updateWhatsAppLink(arrival, nights, guests, unavailable) {
  const propertyName = currentProperty === "dome" ? "Aqeel Dome" : "Aqeel Cabin";
  const statusText = currentLanguage === "es"
    ? (unavailable
        ? "El sitio indica que una o más noches seleccionadas pueden estar ocupadas."
        : "El sitio indica que las noches seleccionadas pueden estar disponibles.")
    : (unavailable
        ? "The website shows that one or more selected nights may be booked."
        : "The website shows that the selected nights may be available.");

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

  if (calendarLoading) {
    setCalendarStatus(ui[currentLanguage].calendarLoading, "loading");
  } else if (!calendarReady) {
    setCalendarStatus(ui[currentLanguage].calendarError, "error");
  }

  const question = byId("faqInput").value.trim();
  if (question.length >= 3) {
    clearTimeout(typingTimer);
    askBackend(question);
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
  byId("openDatePickerBtn").setAttribute("aria-label",
    currentLanguage === "es" ? "Abrir calendario" : "Open calendar");

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
  setText("selectedPropertyDescription", isDome ? t.domeDesc : t.cabinDesc);
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
    { dateStyle: "medium", timeStyle: "short" }
  ).format(date);
}

function byId(id) { return document.getElementById(id); }

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}
