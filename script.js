const loanForm = document.getElementById("loan-form");
const resultWrap = document.getElementById("result-wrap");
const emptyState = document.getElementById("empty-state");
const offersGrid = document.getElementById("offers-grid");
const resetButton = document.getElementById("reset-button");
const sortOffersSelect = document.getElementById("sort-offers");
const formFeedback = document.getElementById("form-feedback");

let lastRankedOffers = [];
let lastInput = null;

const providers = [
  {
    name: "Freo",
    baseRate: 5.1,
    setupFee: 390,
    flexibility: 8.6,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Laag"
  },
  {
    name: "Santander",
    baseRate: 4.8,
    setupFee: 540,
    flexibility: 7.5,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Middel"
  },
  {
    name: "Lender & Spender",
    baseRate: 5.5,
    setupFee: 300,
    flexibility: 8.2,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Laag"
  },
  {
    name: "Rabobank",
    baseRate: 5.9,
    setupFee: 260,
    flexibility: 7.0,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Middel"
  },
  {
    name: "ANWB Lening",
    baseRate: 5.3,
    setupFee: 460,
    flexibility: 9.0,
    freeExtraRepayment: true,
    earlyRepaymentFee: "Geen"
  },
  {
    name: "DEFAM",
    baseRate: 4.9,
    setupFee: 620,
    flexibility: 6.8,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Hoog"
  }
];

const nlCurrency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const nlPercent = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

/* ─── FEEDBACK ─── */
function showFormFeedback(message, type = "error") {
  formFeedback.textContent = message;
  formFeedback.hidden = false;
  formFeedback.classList.toggle("success", type === "success");
}

function hideFormFeedback() {
  formFeedback.hidden = true;
  formFeedback.classList.remove("success");
}

/* ─── INLINE SUMMARY ─── */
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

/* ─── RADIO GROUPS ─── */
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

/* ─── TOGGLES ─── */
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

/* ─── BEREKENING ─── */
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

  const creditMap     = { excellent: -0.45, good: 0, average: 0.65 };
  const employMap     = { permanent: 0, flex: 0.2, "self-employed": 0.35, pension: 0.1, other: 0.25 };
  const vehicleMap    = { new: -0.1, demo: -0.05, used: 0, electric: -0.15, classic: 0.3 };

  return durationAdj + typeAdj + ageAdj
    + (creditMap[creditProfile]  ?? 0)
    + (employMap[employmentType] ?? 0)
    + (vehicleMap[vehicleType]   ?? 0);
}

function preferenceWeights(preference) {
  if (preference === "lowest-total")  return { costWeight: 0.72, flexWeight: 0.18, monthlyWeight: 0.10 };
  if (preference === "highest-flex")  return { costWeight: 0.35, flexWeight: 0.50, monthlyWeight: 0.15 };
  return                                     { costWeight: 0.55, flexWeight: 0.15, monthlyWeight: 0.30 };
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
    const totalScore  = 10 - ((offer.totalCost      - totalMin) / safe(totalMax, totalMin)) * 10;
    const monthScore  = 10 - ((offer.monthlyPayment - monthMin) / safe(monthMax, monthMin)) * 10;
    const flexScore   =      (offer.flexibility     / safe(flexMax, 0)) * 10;
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

/* ─── OFFER CARD ─── */
function createOfferCard(offer, tags) {
  const card = document.createElement("article");
  card.className = "offer-card";

  if (tags.includes("Goedkoopste")) card.classList.add("best-cheap");
  if (tags.includes("Beste keuze")) card.classList.add("best-overall");

  const tagHtml = tags.map(tag =>
    `<span class="offer-tag ${tag === "Goedkoopste" ? "cheap" : "premium"}">${tag}</span>`
  ).join("");

  card.innerHTML = `
    <div class="offer-head">
      <div class="offer-name">${offer.name}</div>
      <div>${tagHtml}</div>
    </div>
    <div class="offer-stats">
      <div class="stat">
        <div class="stat-lbl">Maandlast</div>
        <div class="stat-val">${nlCurrency.format(offer.monthlyPayment)} / mnd</div>
      </div>
      <div class="stat">
        <div class="stat-lbl">Rente</div>
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
      Afsluitkosten ${nlCurrency.format(offer.setupFee)} &middot;
      Extra aflossen ${offer.freeExtraRepayment ? "boetevrij" : "beperkt"} &middot;
      Vervroegd aflossen: ${offer.earlyRepaymentFee}
    </div>
  `;
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

/* ─── RENDER ─── */
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
    `${bestOverall.name} past volgens dit profiel het beste bij uw gekozen focus: ${input.preferenceLabel.toLowerCase()}.`;

  triggerResultReveal();
}

/* ─── RUN ─── */
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

/* ─── EVENTS ─── */
loanForm.addEventListener("submit", e => {
  e.preventDefault();
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
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  document.getElementById("progress").style.width =
    `${maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0}%`;
}, { passive: true });

document.getElementById("yr").textContent = new Date().getFullYear();

/* ─── RESTORE ─── */
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
    showFormFeedback("Eerder ingevulde waarden zijn hersteld. Bereken opnieuw voor de nieuwste vergelijking.", "success");
  } catch (_) {
    try { localStorage.removeItem("apex-loan-form"); } catch (__) {}
    updateInlineSummary();
  }
}

/* ─── INIT ─── */
initRadioGroup("interest-type-group");
initRadioGroup("preference-group");
initRadioGroup("payment-freq-group");

initToggle("balloon-toggle",   "balloon-field");
initToggle("extra-toggle",     "extra-field");
initToggle("insurance-toggle", null);
initToggle("gap-toggle",       null);

restoreSavedFormData();
