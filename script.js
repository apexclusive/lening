const loanForm = document.getElementById("loan-form");
const resultWrap = document.getElementById("result-wrap");
const emptyState = document.getElementById("empty-state");
const offersGrid = document.getElementById("offers-grid");
const resetButton = document.getElementById("reset-button");
const sortOffersSelect = document.getElementById("sort-offers");
const formFeedback = document.getElementById("form-feedback");

let lastRankedOffers = [];
let lastInput = null;
let liveRates = null;
let currentStep = 1;
const totalSteps = 4;
const completedSteps = new Set();

/* ════════════════════════════════════════
   PROVIDERS — basisdata
   Rentes worden overschreven door rates.json
   indien beschikbaar
   ════════════════════════════════════════ */
const providers = [
  {
    name: "Freo",
    baseRate: 5.9,
    setupFee: 0,
    flexibility: 9.2,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Geen",
    url: "https://www.freo.nl",
    note: "Geen afsluitkosten, volledig online"
  },
  {
    name: "Santander Consumer Finance",
    baseRate: 5.4,
    setupFee: 0,
    flexibility: 7.8,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Middel",
    url: "https://www.santanderconsumer.nl",
    note: "Via dealernetwerk en direct"
  },
  {
    name: "Lender & Spender",
    baseRate: 6.1,
    setupFee: 0,
    flexibility: 8.4,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Laag",
    url: "https://www.lenderspender.nl",
    note: "Peer-to-peer, transparant tarief"
  },
  {
    name: "Rabobank",
    baseRate: 6.4,
    setupFee: 0,
    flexibility: 7.0,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Middel",
    url: "https://www.rabobank.nl",
    note: "Vast kantorennetwerk, persoonlijk advies"
  },
  {
    name: "ANWB Lening",
    baseRate: 5.7,
    setupFee: 0,
    flexibility: 9.0,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Geen",
    url: "https://www.anwb.nl/financien/lenen",
    note: "Voordeel voor ANWB-leden"
  },
  {
    name: "DEFAM",
    baseRate: 5.2,
    setupFee: 0,
    flexibility: 6.8,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Hoog",
    url: "https://www.defam.nl",
    note: "Gespecialiseerd in autoleningen"
  },
  {
    name: "ING Bank",
    baseRate: 6.2,
    setupFee: 0,
    flexibility: 7.5,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Laag",
    url: "https://www.ing.nl/particulier/lenen",
    note: "Directe uitbetaling voor ING-klanten"
  },
  {
    name: "ABN AMRO",
    baseRate: 6.5,
    setupFee: 0,
    flexibility: 7.2,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Middel",
    url: "https://www.abnamro.nl/nl/prive/lenen",
    note: "Persoonlijk advies via bank"
  },
  {
    name: "Volkswagen Financial Services",
    baseRate: 4.9,
    setupFee: 250,
    flexibility: 6.5,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Hoog",
    url: "https://www.vwfs.nl",
    note: "Gunstig bij VW, Audi, SEAT, Škoda"
  },
  {
    name: "BMW Financial Services",
    baseRate: 4.7,
    setupFee: 295,
    flexibility: 6.8,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Hoog",
    url: "https://www.bmw.nl/financieren",
    note: "Exclusief voor BMW / MINI"
  },
  {
    name: "Mercedes-Benz Financial Services",
    baseRate: 4.8,
    setupFee: 295,
    flexibility: 6.6,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Hoog",
    url: "https://www.mercedes-benz.nl/financieren",
    note: "Exclusief voor Mercedes-Benz"
  },
  {
    name: "Alpha Credit",
    baseRate: 5.6,
    setupFee: 175,
    flexibility: 7.8,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Laag",
    url: "https://www.alphacredit.nl",
    note: "Gespecialiseerd in consumptief krediet"
  }
];

/* ════════════════════════════════════════
   LIVE RENTES — rates.json
   Maak een bestand rates.json aan op je server:
   {
     "updated": "2025-01-15",
     "source": "Handmatig bijgewerkt op basis van aanbiederpagina's",
     "rates": {
       "Freo": 5.9,
       "Santander Consumer Finance": 5.4,
       ...
     }
   }
   ════════════════════════════════════════ */
async function fetchLiveRates() {
  try {
    const res = await fetch("rates.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("rates.json niet gevonden");
    const data = await res.json();
    liveRates = data;

    const rateNotice = document.getElementById("rate-notice");
    const rateDashboard = document.getElementById("rate-dashboard");
    const rateDate = document.getElementById("rate-date");
    const rateSource = document.getElementById("rate-source");

    if (rateNotice && data.updated) {
      rateNotice.textContent = `Tarieven bijgewerkt: ${data.updated} — ${data.source || "eigen bronnen"}`;
      rateNotice.hidden = false;
    }

    if (rateDashboard && data.updated) {
      rateDashboard.hidden = false;
    }

    if (rateDate && data.updated) {
      rateDate.textContent = `Laatste update ${data.updated}`;
    }

    if (rateSource && data.source) {
      rateSource.textContent = data.source;
    }

    return data.rates || {};
  } catch (_) {
    liveRates = null;
    const rateNotice = document.getElementById("rate-notice");
    const rateDashboard = document.getElementById("rate-dashboard");
    const rateDate = document.getElementById("rate-date");
    const rateSource = document.getElementById("rate-source");
    if (rateNotice) {
      rateNotice.textContent = "Indicatieve tarieven — bezoek aanbieder voor actuele rente";
      rateNotice.hidden = false;
    }
    if (rateDashboard) {
      rateDashboard.hidden = false;
      rateDashboard.classList.add("rate-dashboard--fallback");
    }
    if (rateDate) rateDate.textContent = "Indicatief";
    if (rateSource) rateSource.textContent = "Aanbiedercheck aanbevolen";
    return {};
  }
}

function applyLiveRates(rates) {
  if (!rates || !Object.keys(rates).length) return;
  providers.forEach(p => {
    if (rates[p.name] !== undefined) {
      p.baseRate = Number(rates[p.name]);
    }
  });
}

/* ════════════════════════════════════════
   FORMATTERS
   ════════════════════════════════════════ */
const nlCurrency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const nlPercent = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

/* ════════════════════════════════════════
   FEEDBACK
   ════════════════════════════════════════ */
function showFormFeedback(message, type = "error") {
  formFeedback.textContent = message;
  formFeedback.hidden = false;
  formFeedback.classList.toggle("success", type === "success");
}

function hideFormFeedback() {
  formFeedback.hidden = true;
  formFeedback.classList.remove("success");
}

function updateStepIndicators() {
  document.querySelectorAll(".form-step").forEach(stepEl => {
    const stepNumber = Number(stepEl.dataset.step || 0);
    const isActive = stepNumber === currentStep;
    const isDone = completedSteps.has(stepNumber);
    stepEl.classList.toggle("active", isActive);
    stepEl.classList.toggle("done", isDone);
    if (isActive) {
      stepEl.setAttribute("aria-current", "step");
    } else {
      stepEl.removeAttribute("aria-current");
    }
  });
}

function updateWizardButtons() {
  const prevButton = document.getElementById("prev-step");
  const nextButton = document.getElementById("next-step");
  const submitButton = document.getElementById("submit-btn");

  if (prevButton) prevButton.hidden = currentStep === 1;
  if (nextButton) nextButton.hidden = currentStep === totalSteps;
  if (submitButton) submitButton.hidden = currentStep !== totalSteps;
}

function showStep(step) {
  const nextStep = Math.min(totalSteps, Math.max(1, Number(step) || 1));
  currentStep = nextStep;

  document.querySelectorAll(".wizard-step").forEach(stepEl => {
    const isActive = Number(stepEl.dataset.step) === currentStep;
    stepEl.classList.toggle("active", isActive);
  });

  updateStepIndicators();
  updateWizardButtons();
  hideFormFeedback();
}

function validateStep(step) {
  const stepEl = loanForm.querySelector(`.wizard-step[data-step="${step}"]`);
  if (!stepEl) return true;

  const requiredFields = Array.from(stepEl.querySelectorAll("input[required], select[required]"));
  const firstInvalid = requiredFields.find(field => !field.checkValidity());

  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.reportValidity();
    showFormFeedback("Vul eerst de verplichte velden in voor deze stap.", "error");
    return false;
  }

  hideFormFeedback();
  return true;
}

function goToNextStep() {
  if (!validateStep(currentStep)) return;

  completedSteps.add(currentStep);

  if (currentStep < totalSteps) {
    showStep(currentStep + 1);
  }
}

function goToPreviousStep() {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
}

/* ════════════════════════════════════════
   INLINE SUMMARY
   ════════════════════════════════════════ */
function updateInlineSummary() {
  const carPrice    = Number(document.getElementById("car-price").value)    || 0;
  const downPayment = Number(document.getElementById("down-payment").value) || 0;
  const principal   = Math.max(0, carPrice - downPayment);
  const duration    = document.getElementById("loan-duration").value || "—";

  const principalEl = document.getElementById("summary-principal");
  const durationEl  = document.getElementById("summary-duration-inline");
  const downEl      = document.getElementById("summary-down");

  if (principalEl) principalEl.textContent = nlCurrency.format(principal);
  if (durationEl)  durationEl.textContent  = `${duration} mnd`;
  if (downEl)      downEl.textContent      = nlCurrency.format(downPayment);
}

/* ════════════════════════════════════════
   RADIO GROUPS
   ════════════════════════════════════════ */
function initRadioGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const labels = group.querySelectorAll(".fi-radio");
  labels.forEach((label) => {
    const input = label.querySelector("input[type='radio']");
    if (!input) return;

    if (input.checked) label.classList.add("active");

    label.addEventListener("click", (e) => {
      e.preventDefault();
      labels.forEach((l) => l.classList.remove("active"));
      label.classList.add("active");
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

/* ════════════════════════════════════════
   TOGGLES
   ════════════════════════════════════════ */
function initToggle(toggleWrapperId, linkedFieldId) {
  const wrap = document.getElementById(toggleWrapperId);
  if (!wrap) return;

  const input = wrap.querySelector("input[type='checkbox']");
  if (!input) return;

  function syncState() {
    wrap.classList.toggle("active", input.checked);
    if (linkedFieldId) {
      const field = document.getElementById(linkedFieldId);
      if (field) field.style.display = input.checked ? "" : "none";
    }
  }

  wrap.addEventListener("click", (e) => {
    if (e.target === input) return;
    e.preventDefault();
    input.checked = !input.checked;
    syncState();
  });

  input.addEventListener("change", syncState);
  syncState();
}

/* ════════════════════════════════════════
   BEREKENING
   ════════════════════════════════════════ */
function annuityMonthlyPayment(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return principal * (r * factor) / (factor - 1);
}

function resolveRateAdjustments(formData) {
  const duration       = Number(formData.get("durationMonths"));
  const interestType   = formData.get("interestType");
  const vehicleAge     = Number(formData.get("vehicleAge"));
  const creditProfile  = formData.get("creditProfile");
  const employmentType = formData.get("employmentType") || "permanent";
  const vehicleType    = formData.get("vehicleType")    || "used";

  const durationAdj = duration >= 60 ? 0.55 : duration >= 48 ? 0.35 : duration >= 36 ? 0.15 : -0.05;
  const typeAdj     = interestType === "variable" ? -0.25 : 0;
  const ageAdj      = vehicleAge > 7 ? 0.45 : vehicleAge > 4 ? 0.2 : 0;

  const creditMap  = { excellent: -0.45, good: 0, average: 0.65 };
  const employMap  = { permanent: 0, flex: 0.2, "self-employed": 0.35, pension: 0.1, other: 0.25 };
  const vehicleMap = { new: -0.1, demo: -0.05, used: 0, electric: -0.15, classic: 0.3 };

  return durationAdj + typeAdj + ageAdj
    + (creditMap[creditProfile]  ?? 0)
    + (employMap[employmentType] ?? 0)
    + (vehicleMap[vehicleType]   ?? 0);
}

function preferenceWeights(preference) {
  if (preference === "lowest-total") return { costWeight: 0.72, flexWeight: 0.18, monthlyWeight: 0.10 };
  if (preference === "highest-flex") return { costWeight: 0.35, flexWeight: 0.50, monthlyWeight: 0.15 };
  return                                    { costWeight: 0.55, flexWeight: 0.15, monthlyWeight: 0.30 };
}

function scoreOffers(offers, preference) {
  const totalMin = Math.min(...offers.map(o => o.totalCost));
  const totalMax = Math.max(...offers.map(o => o.totalCost));
  const monthMin = Math.min(...offers.map(o => o.monthlyPayment));
  const monthMax = Math.max(...offers.map(o => o.monthlyPayment));
  const flexMax  = Math.max(...offers.map(o => o.flexibility));

  const safe    = (max, min) => (max - min) || 1;
  const weights = preferenceWeights(preference);

  return offers.map(offer => {
    const totalScore    = 10 - ((offer.totalCost      - totalMin) / safe(totalMax, totalMin)) * 10;
    const monthScore    = 10 - ((offer.monthlyPayment - monthMin) / safe(monthMax, monthMin)) * 10;
    const flexScore     =      (offer.flexibility     / safe(flexMax, 0)) * 10;
    const weightedScore =
      totalScore * weights.costWeight +
      flexScore  * weights.flexWeight +
      monthScore * weights.monthlyWeight;
    return { ...offer, weightedScore };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
}

function sortOffers(offers, sortKey) {
  const s = [...offers];
  if (sortKey === "monthly") return s.sort((a, b) => a.monthlyPayment - b.monthlyPayment);
  if (sortKey === "total")   return s.sort((a, b) => a.totalCost      - b.totalCost);
  if (sortKey === "apr")     return s.sort((a, b) => a.apr            - b.apr);
  if (sortKey === "flex")    return s.sort((a, b) => b.flexibility    - a.flexibility);
  return s.sort((a, b) => b.weightedScore - a.weightedScore);
}

/* ════════════════════════════════════════
   OFFER CARD
   ════════════════════════════════════════ */
function createOfferCard(offer, tags) {
  const card = document.createElement("article");
  card.className = "offer-card offer-card--compact is-collapsed";

  if (tags.includes("Goedkoopste")) card.classList.add("best-cheap");
  if (tags.includes("Beste keuze")) card.classList.add("best-overall");

  const tagHtml = tags.map(tag =>
    `<span class="offer-tag ${tag === "Goedkoopste" ? "cheap" : "premium"}">${tag}</span>`
  ).join("");

  const offerSlug = offer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const rateSourceLabel = liveRates?.rates?.[offer.name]
    ? `<span style="color:rgba(180,244,207,.7);font-size:.48rem;letter-spacing:.1em;">● live tarief</span>`
    : `<span style="color:rgba(198,203,209,.3);font-size:.48rem;letter-spacing:.1em;">● indicatief</span>`;

  card.innerHTML = `
    <div class="offer-head">
      <div class="offer-name">${offer.name}</div>
      <div class="offer-tags">
        ${tagHtml}
      </div>
    </div>
    <div class="offer-summary">
      <div class="offer-summary-item">
        <span class="summary-label">Maandlast</span>
        <span class="summary-value">${nlCurrency.format(offer.monthlyPayment)}</span>
      </div>
      <div class="offer-summary-item">
        <span class="summary-label">Totaal</span>
        <span class="summary-value">${nlCurrency.format(offer.totalCost)}</span>
      </div>
      <div class="offer-summary-item">
        <span class="summary-label">Rente</span>
        <span class="summary-value">${nlPercent.format(offer.apr)}%</span>
      </div>
    </div>
    <button class="offer-expand" type="button" aria-expanded="false" aria-controls="offer-details-${offerSlug}">
      <span class="offer-expand-text">Details</span>
      <span class="offer-expand-icon" aria-hidden="true"></span>
    </button>
    <div class="offer-details" id="offer-details-${offerSlug}">
      <div class="offer-stats">
        <div class="stat">
          <div class="stat-lbl">Maandlast</div>
          <div class="stat-val">${nlCurrency.format(offer.monthlyPayment)} / mnd</div>
        </div>
        <div class="stat">
          <div class="stat-lbl">Rente ${rateSourceLabel}</div>
          <div class="stat-val">${nlPercent.format(offer.apr)}%</div>
        </div>
        <div class="stat">
          <div class="stat-lbl">Totale kosten</div>
          <div class="stat-val">${nlCurrency.format(offer.totalCost)}</div>
        </div>
        <div class="stat">
          <div class="stat-lbl">Flexibiliteit</div>
          <div class="stat-val">${nlPercent.format(offer.flexibility)} / 10</div>
        </div>
      </div>
      <div class="offer-foot">
        ${offer.setupFee > 0 ? `Afsluitkosten ${nlCurrency.format(offer.setupFee)} &middot; ` : "Geen afsluitkosten &middot; "}
        Extra aflossen ${offer.freeExtraRepayment ? "boetevrij" : "beperkt"} &middot;
        Vervroegd: ${offer.earlyRepaymentFee} &middot;
        ${offer.note}
      </div>
      <div class="offer-foot offer-foot-link">
        <a href="${offer.url}" target="_blank" rel="noreferrer noopener">
          Bekijk aanbieder ↗
        </a>
      </div>
    </div>
  `;

  const expandButton = card.querySelector(".offer-expand");
  if (expandButton) {
    expandButton.addEventListener("click", () => {
      const isExpanded = card.classList.toggle("expanded");
      expandButton.setAttribute("aria-expanded", String(isExpanded));
      const text = expandButton.querySelector(".offer-expand-text");
      if (text) text.textContent = isExpanded ? "Sluiten" : "Details";
    });
  }

  return card;
}

function animateOfferCards() {
  offersGrid.querySelectorAll(".offer-card").forEach((card, i) => {
    card.style.setProperty("--stagger", i);
  });
}

function triggerResultReveal() {
  resultWrap.classList.remove("reveal");
  void resultWrap.offsetWidth;
  resultWrap.classList.add("reveal");
}

/* ════════════════════════════════════════
   RENDER
   ════════════════════════════════════════ */
function renderResults(rankedOffers, input) {
  const offersForGrid     = sortOffers(rankedOffers, sortOffersSelect.value);
  const cheapestByMonthly = [...rankedOffers].sort((a, b) => a.monthlyPayment - b.monthlyPayment)[0];
  const cheapestByTotal   = [...rankedOffers].sort((a, b) => a.totalCost      - b.totalCost)[0];
  const bestOverall       = [...rankedOffers].sort((a, b) => b.weightedScore  - a.weightedScore)[0];

  offersGrid.innerHTML = "";
  offersForGrid.forEach(offer => {
    const tags = [];
    if (offer.name === cheapestByMonthly.name) tags.push("Goedkoopste");
    if (offer.name === bestOverall.name)       tags.push("Beste keuze");
    offersGrid.appendChild(createOfferCard(offer, tags));
  });
  animateOfferCards();

  const avgRate = rankedOffers.reduce((acc, o) => acc + o.apr, 0) / rankedOffers.length;
  const top3    = [...rankedOffers].sort((a, b) => a.monthlyPayment - b.monthlyPayment).slice(0, 3).map(o => o.monthlyPayment);
  const spread  = top3.length > 1 ? Math.max(...top3) - Math.min(...top3) : 0;

  document.getElementById("best-monthly").textContent      = `${nlCurrency.format(cheapestByMonthly.monthlyPayment)} / maand`;
  document.getElementById("best-monthly-sub").textContent  = `${cheapestByMonthly.name} geeft uw laagste maandlast`;
  document.getElementById("best-overall").textContent      = bestOverall.name;
  document.getElementById("best-overall-sub").textContent  = `Score ${nlPercent.format(bestOverall.weightedScore)} / 10 op uw voorkeur`;
  document.getElementById("lowest-total").textContent      = nlCurrency.format(cheapestByTotal.totalCost);
  document.getElementById("lowest-total-sub").textContent  = `${cheapestByTotal.name} heeft het laagste totaalbedrag`;
  document.getElementById("avg-rate").textContent          = `${nlPercent.format(avgRate)}%`;
  document.getElementById("loan-principal").textContent    = nlCurrency.format(input.principal);
  document.getElementById("summary-duration").textContent  = `${input.duration} maanden`;
  document.getElementById("summary-interest-type").textContent = input.interestTypeLabel;
  document.getElementById("summary-preference").textContent    = input.preferenceLabel;
  document.getElementById("spread-value").textContent      = `${nlCurrency.format(spread)} / maand`;
  document.getElementById("focus-value").textContent       = input.preferenceLabel;
  document.getElementById("negotiation-value").textContent = spread > 35 ? "Sterk" : spread > 20 ? "Gemiddeld" : "Beperkt";
  document.getElementById("result-footnote").textContent   =
    `${bestOverall.name} past het beste bij uw profiel — bezoek de aanbieder voor de definitieve offerte.`;

  triggerResultReveal();
}

/* ════════════════════════════════════════
   RUN COMPARISON
   ════════════════════════════════════════ */
function runComparison(formData) {
  const carPrice    = Number(formData.get("carPrice"));
  const downPayment = Number(formData.get("downPayment"));
  const duration    = Number(formData.get("durationMonths"));
  const preference  = formData.get("preferredFeature") || "lowest-monthly";

  if (!Number.isFinite(carPrice) || !Number.isFinite(downPayment) || carPrice < 2500 || duration <= 0) {
    showFormFeedback("Controleer de invoerwaarden. Vul een geldige aankoopprijs, aanbetaling en looptijd in.");
    return;
  }
  if (downPayment >= carPrice) {
    showFormFeedback("Aanbetaling moet lager zijn dan de aankoopprijs van de auto.");
    return;
  }

  const raw       = carPrice - downPayment;
  const principal = Math.max(1500, raw);

  if (raw < 1500) {
    showFormFeedback("Financieringsbedrag automatisch op minimaal € 1.500 gezet.", "success");
  } else {
    hideFormFeedback();
  }

  const rateAdj = resolveRateAdjustments(formData);
  const offers  = providers.map(p => {
    const apr            = Math.max(3.2, p.baseRate + rateAdj);
    const monthlyPayment = annuityMonthlyPayment(principal, apr, duration);
    const totalCost      = monthlyPayment * duration + p.setupFee;
    return { ...p, apr, monthlyPayment, totalCost };
  });

  const ranked = scoreOffers(offers, preference);
  lastRankedOffers = ranked;

  const preferenceLabelMap = {
    "lowest-monthly": "Laagste maandlast",
    "lowest-total":   "Laagste totale kosten",
    "highest-flex":   "Maximale flexibiliteit"
  };

  lastInput = {
    principal,
    duration,
    interestTypeLabel: formData.get("interestType") === "variable" ? "Variabele rente" : "Vaste rente",
    preferenceLabel:   preferenceLabelMap[preference] || "Laagste maandlast"
  };

  emptyState.hidden = true;
  resultWrap.hidden = false;
  renderResults(ranked, lastInput);

  try {
    localStorage.setItem("apex-loan-form", JSON.stringify(Object.fromEntries(formData.entries())));
  } catch (_) {}

  resultWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ════════════════════════════════════════
   EVENTS
   ════════════════════════════════════════ */
loanForm.addEventListener("submit", e => {
  e.preventDefault();

  if (currentStep !== totalSteps) {
    goToNextStep();
    return;
  }

  completedSteps.add(currentStep);

  const btn = loanForm.querySelector(".calc-btn");
  btn.classList.add("loading");
  runComparison(new FormData(loanForm));
  setTimeout(() => btn.classList.remove("loading"), 260);
});

sortOffersSelect.addEventListener("change", () => {
  if (lastRankedOffers.length && lastInput) {
    renderResults(lastRankedOffers, lastInput);
    resultWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

["car-price", "down-payment", "loan-duration"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", () => { updateInlineSummary(); hideFormFeedback(); });
});

document.getElementById("prev-step").addEventListener("click", goToPreviousStep);
document.getElementById("next-step").addEventListener("click", goToNextStep);

document.querySelectorAll(".form-step").forEach(stepEl => {
  stepEl.addEventListener("click", () => {
    const targetStep = Number(stepEl.dataset.step || 0);
    if (targetStep <= currentStep && targetStep > 0) {
      showStep(targetStep);
    }
  });
});

resetButton.addEventListener("click", () => {
  loanForm.reset();

  document.getElementById("car-price").value       = 28500;
  document.getElementById("down-payment").value    = 4500;
  document.getElementById("vehicle-age").value     = 4;
  document.getElementById("loan-duration").value   = "48";
  document.getElementById("credit-profile").value  = "good";
  document.getElementById("employment-type").value = "permanent";
  document.getElementById("vehicle-type").value    = "used";
  document.getElementById("loan-type").value       = "annuity";

  ["interest-type-group", "preference-group", "payment-freq-group"].forEach(groupId => {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll(".fi-radio").forEach((label, i) => {
      const input = label.querySelector("input");
      if (!input) return;
      input.checked = i === 0;
      label.classList.toggle("active", i === 0);
    });
  });

  ["balloon-toggle", "extra-toggle", "insurance-toggle", "gap-toggle"].forEach(id => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const input = wrap.querySelector("input[type='checkbox']");
    if (!input) return;
    input.checked = false;
    wrap.classList.remove("active");
  });

  ["balloon-field", "extra-field"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  sortOffersSelect.value = "overall";
  try { localStorage.removeItem("apex-loan-form"); } catch (_) {}

  updateInlineSummary();
  hideFormFeedback();
  resultWrap.hidden = true;
  resultWrap.classList.remove("reveal");
  emptyState.hidden = false;
  completedSteps.clear();
  showStep(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

let progressFrame = null;
window.addEventListener("scroll", () => {
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const width = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    const progressBar = document.getElementById("progress");
    if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, width))}%`;
    progressFrame = null;
  });
}, { passive: true });

document.getElementById("yr").textContent = new Date().getFullYear();

/* ════════════════════════════════════════
   RESTORE
   ════════════════════════════════════════ */
function restoreSavedFormData() {
  updateInlineSummary();

  let raw;
  try { raw = localStorage.getItem("apex-loan-form"); } catch (_) { return; }
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    Object.entries(saved).forEach(([name, value]) => {
      const radios = loanForm.querySelectorAll(`input[type="radio"][name="${name}"]`);
      if (radios.length) {
        radios.forEach(r => { r.checked = r.value === value; });
        return;
      }
      const field = loanForm.elements.namedItem(name);
      if (!field) return;
      if (field.type === "checkbox") {
        field.checked = value === "on" || value === "true";
      } else {
        field.value = value;
      }
    });

    ["interest-type-group", "preference-group", "payment-freq-group"].forEach(groupId => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll(".fi-radio").forEach(label => {
        const input = label.querySelector("input");
        if (input) label.classList.toggle("active", input.checked);
      });
    });

    [
      { toggleId: "balloon-toggle",   fieldId: "balloon-field" },
      { toggleId: "extra-toggle",     fieldId: "extra-field"   },
      { toggleId: "insurance-toggle", fieldId: null            },
      { toggleId: "gap-toggle",       fieldId: null            }
    ].forEach(({ toggleId, fieldId }) => {
      const wrap = document.getElementById(toggleId);
      if (!wrap) return;
      const input = wrap.querySelector("input[type='checkbox']");
      if (!input) return;
      wrap.classList.toggle("active", input.checked);
      if (fieldId) {
        const f = document.getElementById(fieldId);
        if (f) f.style.display = input.checked ? "" : "none";
      }
    });

    updateInlineSummary();
    hideFormFeedback();
  } catch (_) {
    try { localStorage.removeItem("apex-loan-form"); } catch (__) {}
    updateInlineSummary();
    hideFormFeedback();
  }
}

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
initRadioGroup("interest-type-group");
initRadioGroup("preference-group");
initRadioGroup("payment-freq-group");

initToggle("balloon-toggle",   "balloon-field");
initToggle("extra-toggle",     "extra-field");
initToggle("insurance-toggle", null);
initToggle("gap-toggle",       null);

showStep(1);

fetchLiveRates().then(rates => {
  applyLiveRates(rates);
  restoreSavedFormData();
});

const resultWrapNode = document.getElementById("result-wrap");
if (resultWrapNode) {
  resultWrapNode.setAttribute("data-ready", "true");
}
