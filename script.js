const loanForm = document.getElementById("loan-form");
const resultWrap = document.getElementById("result-wrap");
const emptyState = document.getElementById("empty-state");
const offersGrid = document.getElementById("offers-grid");
const resetButton = document.getElementById("reset-button");
const sortOffersSelect = document.getElementById("sort-offers");
const inlineSummary = document.getElementById("inline-summary");
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
    flexibility: 7,
    freeExtraRepayment: false,
    earlyRepaymentFee: "Middel"
  },
  {
    name: "ANWB Lening",
    baseRate: 5.3,
    setupFee: 460,
    flexibility: 9,
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

function showFormFeedback(message, type = "error") {
  formFeedback.textContent = message;
  formFeedback.hidden = false;
  formFeedback.classList.toggle("success", type === "success");
}

function hideFormFeedback() {
  formFeedback.hidden = true;
  formFeedback.classList.remove("success");
}

function updateInlinePrincipalSummary() {
  const carPrice = Number(document.getElementById("car-price").value) || 0;
  const downPayment = Number(document.getElementById("down-payment").value) || 0;
  const principal = Math.max(0, carPrice - downPayment);
  inlineSummary.textContent = `Financieringsbedrag: ${nlCurrency.format(principal)}`;
}

function annuityMonthlyPayment(principal, annualRate, months) {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) {
    return principal / months;
  }
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * ((monthlyRate * factor) / (factor - 1));
}

function resolveRateAdjustments(formData) {
  const duration = Number(formData.get("durationMonths"));
  const interestType = formData.get("interestType");
  const vehicleAge = Number(formData.get("vehicleAge"));
  const creditProfile = formData.get("creditProfile");

  const durationAdj = duration >= 60 ? 0.55 : duration >= 48 ? 0.35 : duration >= 36 ? 0.15 : -0.05;
  const typeAdj = interestType === "variable" ? -0.25 : 0;
  const ageAdj = vehicleAge > 7 ? 0.45 : vehicleAge > 4 ? 0.2 : 0;

  const creditAdjMap = {
    excellent: -0.45,
    good: 0,
    average: 0.65
  };

  return durationAdj + typeAdj + ageAdj + creditAdjMap[creditProfile];
}

function preferenceWeights(preference) {
  if (preference === "lowest-total") {
    return { costWeight: 0.72, flexWeight: 0.18, monthlyWeight: 0.1 };
  }
  if (preference === "highest-flex") {
    return { costWeight: 0.35, flexWeight: 0.5, monthlyWeight: 0.15 };
  }
  return { costWeight: 0.55, flexWeight: 0.15, monthlyWeight: 0.3 };
}

function sortOffers(offers, sortKey) {
  const sorted = [...offers];
  if (sortKey === "monthly") {
    return sorted.sort((a, b) => a.monthlyPayment - b.monthlyPayment);
  }
  if (sortKey === "total") {
    return sorted.sort((a, b) => a.totalCost - b.totalCost);
  }
  if (sortKey === "apr") {
    return sorted.sort((a, b) => a.apr - b.apr);
  }
  if (sortKey === "flex") {
    return sorted.sort((a, b) => b.flexibility - a.flexibility);
  }
  return sorted.sort((a, b) => b.weightedScore - a.weightedScore);
}

function scoreOffers(offers, preference) {
  const totalMin = Math.min(...offers.map((o) => o.totalCost));
  const totalMax = Math.max(...offers.map((o) => o.totalCost));
  const monthMin = Math.min(...offers.map((o) => o.monthlyPayment));
  const monthMax = Math.max(...offers.map((o) => o.monthlyPayment));
  const flexMax = Math.max(...offers.map((o) => o.flexibility));

  const safeRange = (max, min) => (max - min) || 1;
  const totalRange = safeRange(totalMax, totalMin);
  const monthRange = safeRange(monthMax, monthMin);
  const flexRange = safeRange(flexMax, 0);

  const weights = preferenceWeights(preference);

  return offers
    .map((offer) => {
      const totalScore = 10 - ((offer.totalCost - totalMin) / totalRange) * 10;
      const monthScore = 10 - ((offer.monthlyPayment - monthMin) / monthRange) * 10;
      const flexScore = (offer.flexibility / flexRange) * 10;
      const weightedScore =
        totalScore * weights.costWeight +
        flexScore * weights.flexWeight +
        monthScore * weights.monthlyWeight;

      return {
        ...offer,
        weightedScore
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

function createOfferCard(offer, tags) {
  const card = document.createElement("article");
  card.className = "offer-card";

  if (tags.includes("Goedkoopste")) {
    card.classList.add("best-cheap");
  }
  if (tags.includes("Beste keuze")) {
    card.classList.add("best-overall");
  }

  const tagHtml = tags
    .map((tag) => `<span class="offer-tag ${tag === "Goedkoopste" ? "cheap" : "premium"}">${tag}</span>`)
    .join("");

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
      Afsluitkosten ${nlCurrency.format(offer.setupFee)} · Extra aflossen ${offer.freeExtraRepayment ? "boetevrij" : "beperkt"} · Vervroegd aflossen: ${offer.earlyRepaymentFee}
    </div>
  `;

  return card;
}

function animateOfferCards() {
  const cards = offersGrid.querySelectorAll(".offer-card");
  cards.forEach((card, index) => {
    card.style.setProperty("--stagger", index);
  });
}

function triggerResultReveal() {
  resultWrap.classList.remove("reveal");
  void resultWrap.offsetWidth;
  resultWrap.classList.add("reveal");
}

function renderResults(rankedOffers, input) {
  const sortKey = sortOffersSelect.value;
  const offersForGrid = sortOffers(rankedOffers, sortKey);

  const cheapestByMonthly = [...rankedOffers].sort((a, b) => a.monthlyPayment - b.monthlyPayment)[0];
  const cheapestByTotal = [...rankedOffers].sort((a, b) => a.totalCost - b.totalCost)[0];
  const bestOverall = [...rankedOffers].sort((a, b) => b.weightedScore - a.weightedScore)[0];

  offersGrid.innerHTML = "";

  offersForGrid.forEach((offer) => {
    const tags = [];
    if (offer.name === cheapestByMonthly.name) {
      tags.push("Goedkoopste");
    }
    if (offer.name === bestOverall.name) {
      tags.push("Beste keuze");
    }
    offersGrid.appendChild(createOfferCard(offer, tags));
  });

  animateOfferCards();

  const avgRate = rankedOffers.reduce((acc, offer) => acc + offer.apr, 0) / rankedOffers.length;
  const topThreeMonthly = [...rankedOffers]
    .sort((a, b) => a.monthlyPayment - b.monthlyPayment)
    .slice(0, 3)
    .map((offer) => offer.monthlyPayment);
  const monthlySpread = topThreeMonthly.length > 1 ? Math.max(...topThreeMonthly) - Math.min(...topThreeMonthly) : 0;

  document.getElementById("best-monthly").textContent = `${nlCurrency.format(cheapestByMonthly.monthlyPayment)} / maand`;
  document.getElementById("best-monthly-sub").textContent = `${cheapestByMonthly.name} geeft uw laagste maandlast`;
  document.getElementById("best-overall").textContent = bestOverall.name;
  document.getElementById("best-overall-sub").textContent = `Score ${nlPercent.format(bestOverall.weightedScore)} / 10 op uw voorkeur`;
  document.getElementById("lowest-total").textContent = nlCurrency.format(cheapestByTotal.totalCost);
  document.getElementById("lowest-total-sub").textContent = `${cheapestByTotal.name} heeft het laagste totaalbedrag`;
  document.getElementById("avg-rate").textContent = `${nlPercent.format(avgRate)}%`;
  document.getElementById("loan-principal").textContent = nlCurrency.format(input.principal);

  document.getElementById("summary-duration").textContent = `${input.duration} maanden`;
  document.getElementById("summary-interest-type").textContent = input.interestTypeLabel;
  document.getElementById("summary-preference").textContent = input.preferenceLabel;
  document.getElementById("spread-value").textContent = `${nlCurrency.format(monthlySpread)} / maand`;
  document.getElementById("focus-value").textContent = input.preferenceLabel;

  const negotiationLabel = monthlySpread > 35 ? "Sterk" : monthlySpread > 20 ? "Gemiddeld" : "Beperkt";
  document.getElementById("negotiation-value").textContent = negotiationLabel;

  document.getElementById("result-footnote").textContent =
    `${bestOverall.name} past volgens dit profiel het beste bij uw gekozen focus: ${input.preferenceLabel.toLowerCase()}.`;

  triggerResultReveal();
}

function runComparison(formData) {
  const carPrice = Number(formData.get("carPrice"));
  const downPayment = Number(formData.get("downPayment"));
  const duration = Number(formData.get("durationMonths"));
  const preference = formData.get("preferredFeature");

  if (!Number.isFinite(carPrice) || !Number.isFinite(downPayment) || carPrice < 2500 || duration <= 0) {
    showFormFeedback("Controleer de invoerwaarden. Vul een geldige aankoopprijs, aanbetaling en looptijd in.");
    return;
  }

  if (downPayment >= carPrice) {
    showFormFeedback("Aanbetaling moet lager zijn dan de aankoopprijs van de auto.");
    return;
  }

  const principal = Math.max(1500, carPrice - downPayment);

  if (carPrice - downPayment < 1500) {
    showFormFeedback("Het financieringsbedrag is automatisch op minimaal € 1.500 gezet voor realistische vergelijking.");
  } else {
    hideFormFeedback();
  }

  const rateAdjustment = resolveRateAdjustments(formData);

  const offers = providers.map((provider) => {
    const apr = Math.max(3.2, provider.baseRate + rateAdjustment);
    const monthlyPayment = annuityMonthlyPayment(principal, apr, duration);
    const totalCost = monthlyPayment * duration + provider.setupFee;

    return {
      ...provider,
      apr,
      monthlyPayment,
      totalCost
    };
  });

  const ranked = scoreOffers(offers, preference);
  lastRankedOffers = ranked;

  const interestTypeLabel = formData.get("interestType") === "fixed" ? "Vaste rente" : "Variabele rente";
  const preferenceLabelMap = {
    "lowest-monthly": "Laagste maandlast",
    "lowest-total": "Laagste totale kosten",
    "highest-flex": "Maximale flexibiliteit"
  };

  lastInput = {
    principal,
    duration,
    interestTypeLabel,
    preferenceLabel: preferenceLabelMap[preference]
  };

  emptyState.hidden = true;
  resultWrap.hidden = false;

  renderResults(ranked, lastInput);

  localStorage.setItem("apex-loan-form", JSON.stringify(Object.fromEntries(formData.entries())));
  resultWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

loanForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = loanForm.querySelector(".calc-btn");
  submitButton.classList.add("loading");
  const formData = new FormData(loanForm);
  runComparison(formData);
  setTimeout(() => {
    submitButton.classList.remove("loading");
  }, 260);
});

sortOffersSelect.addEventListener("change", () => {
  if (lastRankedOffers.length && lastInput) {
    renderResults(lastRankedOffers, lastInput);
    resultWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

["car-price", "down-payment"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    updateInlinePrincipalSummary();
    hideFormFeedback();
  });
});

resetButton.addEventListener("click", () => {
  loanForm.reset();
  document.getElementById("car-price").value = 28500;
  document.getElementById("down-payment").value = 4500;
  document.getElementById("vehicle-age").value = 4;
  document.getElementById("loan-duration").value = "48";
  document.getElementById("interest-type").value = "fixed";
  document.getElementById("credit-profile").value = "good";
  document.getElementById("preferred-feature").value = "lowest-monthly";
  sortOffersSelect.value = "overall";
  localStorage.removeItem("apex-loan-form");
  updateInlinePrincipalSummary();
  hideFormFeedback();
  resultWrap.hidden = true;
  resultWrap.classList.remove("reveal");
  emptyState.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
  document.getElementById("progress").style.width = `${progress}%`;
});

document.getElementById("yr").textContent = new Date().getFullYear();

function restoreSavedFormData() {
  const raw = localStorage.getItem("apex-loan-form");
  if (!raw) {
    updateInlinePrincipalSummary();
    return;
  }

  try {
    const saved = JSON.parse(raw);
    Object.entries(saved).forEach(([name, value]) => {
      const field = loanForm.elements.namedItem(name);
      if (field) {
        field.value = value;
      }
    });
    updateInlinePrincipalSummary();
    showFormFeedback("Eerder ingevulde waarden zijn hersteld. Bereken opnieuw voor de nieuwste vergelijking.", "success");
  } catch {
    localStorage.removeItem("apex-loan-form");
    updateInlinePrincipalSummary();
  }
}

restoreSavedFormData();
