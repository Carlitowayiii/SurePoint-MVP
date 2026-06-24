/* SafetyOS – Full Suite MVP (Industry-Aware + Fully Wired)
   - Offline/localStorage
   - Dynamic categories by industry
   - No dead buttons
   - Safer rendering
   - Repopulates forms when selecting cases
   - Better validation
   - Reassigns ownership if users are deleted
*/

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const uid = () => {
    if (window.crypto?.randomUUID) {
      return "C" + crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    }
    return "C" + Math.random().toString(36).slice(2, 11).toUpperCase();
  };

  const LS_KEY = "safetyOS_state_v3";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const safeText = (value, fallback = "—") => {
    const v = String(value ?? "").trim();
    return escapeHtml(v || fallback);
  };

  const safeNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // ---------- Industry / Category Maps ----------
  const INDUSTRY_CATEGORIES = {
    "Airport Operator": [
      "Runway Safety",
      "Ground Operations",
      "Vehicle / Ramp Operations",
      "Wildlife Strike",
      "FOD / Housekeeping",
      "Security",
      "Emergency Response",
      "Weather",
      "Contractor Oversight",
      "Other"
    ],
    "Fixed-Wing Operator": [
      "Flight Operations",
      "Maintenance",
      "ATC / Communications",
      "Human Factors / Fatigue",
      "Training / Checking",
      "Dispatch / Flight Planning",
      "Ground Handling",
      "Weather",
      "Security",
      "Other"
    ],
    "Rotorcraft Operator": [
      "Flight Operations",
      "Maintenance",
      "Human Factors / Fatigue",
      "Mission Risk",
      "Landing Zone Safety",
      "Training / Checking",
      "Ground Handling",
      "Weather",
      "Security",
      "Other"
    ],
    "UAS Operator": [
      "UAS Flight Operations",
      "Lost Link / C2",
      "Battery / Power Systems",
      "Airspace / ATC Coordination",
      "Visual Observer / Crew Resource Management",
      "Maintenance / Hardware",
      "Human Factors / Fatigue",
      "Ground Risk / People / Property",
      "Weather",
      "Security / Cyber",
      "Other"
    ],
    "Manufacturing": [
      "Machine Safety",
      "Lockout / Tagout",
      "PPE",
      "Chemical Exposure",
      "Ergonomics",
      "Forklift / Material Handling",
      "Fire / Explosion",
      "Quality / Process Deviation",
      "Contractor Safety",
      "Other"
    ],
    "Vehicle Fleet": [
      "Driver Safety",
      "Vehicle Maintenance",
      "Backing / Parking",
      "Loading / Unloading",
      "Fatigue / Hours of Service",
      "Distracted Driving",
      "Weather",
      "Fleet Compliance",
      "Security",
      "Other"
    ],
    "Healthcare": [
      "Patient Safety",
      "Medication Error",
      "Infection Control",
      "Staff Injury",
      "Equipment Failure",
      "Sharps / Biohazard",
      "Security / Workplace Violence",
      "Environment of Care",
      "Other"
    ],
    "Construction": [
      "Fall Protection",
      "Scaffolding",
      "Excavation / Trenching",
      "Electrical Safety",
      "Heavy Equipment",
      "PPE",
      "Crane / Rigging",
      "Traffic Control",
      "Contractor Coordination",
      "Other"
    ],
    "Energy / Utilities": [
      "Electrical Safety",
      "Arc Flash",
      "Line Work",
      "Confined Space",
      "Working at Heights",
      "Vehicle / Fleet",
      "Contractor Safety",
      "Outage / Switching",
      "Environmental Release",
      "Other"
    ],
    "Logistics / Trucking": [
      "Driver Safety",
      "Warehouse Safety",
      "Loading Dock",
      "Forklift / Material Handling",
      "Hours of Service / Fatigue",
      "Vehicle Maintenance",
      "Cargo Securement",
      "Weather",
      "Security",
      "Other"
    ],
    "Government / Defense": [
      "Operational Safety",
      "Range / Mission Safety",
      "Maintenance",
      "Human Factors / Fatigue",
      "Security",
      "Environmental Compliance",
      "Vehicle / Fleet",
      "Training",
      "Emergency Response",
      "Other"
    ],
    "Other": [
      "General Safety",
      "Human Factors / Fatigue",
      "Maintenance / Equipment",
      "Compliance",
      "Training",
      "Security",
      "Weather",
      "Environmental",
      "Other"
    ]
  };

  const DEFAULT_ORG_TYPES = [
    "Airport Operator",
    "Fixed-Wing Operator",
    "Rotorcraft Operator",
    "UAS Operator",
    "Manufacturing",
    "Vehicle Fleet",
    "Healthcare",
    "Construction",
    "Energy / Utilities",
    "Logistics / Trucking",
    "Government / Defense",
    "Other"
  ];

  const getCategoriesForIndustry = (industry) => {
    return INDUSTRY_CATEGORIES[industry] || INDUSTRY_CATEGORIES["Other"];
  };

  const getDefaultCategoryForIndustry = (industry) => {
    return getCategoriesForIndustry(industry)[0] || "Other";
  };

  const populateSelect = (selector, items, selectedValue = "") => {
    const el = $(selector);
    if (!el) return;
    el.innerHTML = items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    const hasSelected = items.includes(selectedValue);
    el.value = hasSelected ? selectedValue : (items[0] || "");
  };

  const populateIndustrySelects = () => {
    populateSelect("#orgType", DEFAULT_ORG_TYPES, $("#orgType")?.value || "Airport Operator");
    populateSelect("#dashOrgType", DEFAULT_ORG_TYPES, $("#dashOrgType")?.value || "Airport Operator");
  };

  const syncCategoryDropdown = (industrySelector, categorySelector, preferredCategory = "") => {
    const industry = $(industrySelector)?.value || "Other";
    const categories = getCategoriesForIndustry(industry);
    populateSelect(categorySelector, categories, preferredCategory || $(categorySelector)?.value || "");
  };

  // ---------- Defaults ----------
  const DEFAULT_USERS = [
    { id: "U1", name: "Safety Manager", pin: "1111" },
    { id: "U2", name: "Investigator", pin: "2222" },
    { id: "U3", name: "EHS Lead", pin: "3333" },
    { id: "U4", name: "Ops Director", pin: "4444" },
  ];

  const DEFAULT_POLICIES = [
    {
      id: "P1",
      name: "Just Culture Policy",
      text: "Just Culture: Encourage reporting. Distinguish error, at-risk, and reckless behavior..."
    },
    {
      id: "P2",
      name: "SMS Reporting Policy",
      text: "All hazards, near-misses, and incidents must be reported within 24 hours..."
    },
    {
      id: "P3",
      name: "OSHA Recordkeeping",
      text: "Record injuries/illnesses per 29 CFR 1904. Determine recordability and classification..."
    },
  ];

  const DEFAULT_FACTORS = [
    "Fatigue", "Training", "Procedure", "Communication", "Supervision",
    "Maintenance", "Weather", "Equipment", "Human Factors", "Design/Engineering",
    "LOTO/PPE", "Ramp/Vehicle Ops", "UAS Ops", "Policy/Compliance"
  ];

  const DEFAULT_STATE = () => ({
    users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
    activeUserId: DEFAULT_USERS[0].id,
    policies: JSON.parse(JSON.stringify(DEFAULT_POLICIES)),
    cases: [],
    inspections: [],
    ui: { activeView: "dashboard", selectedCaseId: null }
  });

  const RISK_LABEL = (sev, lik) => {
    const score = Number(sev) * Number(lik);
    if (score >= 16) return { label: "High", pill: "danger", score };
    if (score >= 9) return { label: "Medium", pill: "warn", score };
    return { label: "Low", pill: "ok", score };
  };

  const toast = (msg) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  };

  const downloadText = (filename, text, mime = "text/plain;charset=utf-8") => {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const setField = (selector, value, fallback = "") => {
    const el = $(selector);
    if (!el) return;
    el.value = value ?? fallback;
  };

  const setRadioGroup = (name, value) => {
    const target = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (target) target.checked = true;
  };

  const setPanelVisibility = (el, visible) => {
    if (!el) return;
    if ("hidden" in el) el.hidden = !visible;
    el.style.display = visible ? "" : "none";
  };

  const syncSelectOptions = (selector, optionsHtml, preferredValue = "") => {
    const el = $(selector);
    if (!el) return;
    const current = preferredValue || el.value || "";
    el.innerHTML = optionsHtml;
    const hasCurrent = [...el.options].some(o => o.value === current);
    if (hasCurrent) el.value = current;
    else if (el.options.length) el.value = el.options[0].value;
  };

  const normalizeCase = (c) => {
    const orgType = c.intake?.orgType || "Other";
    const category = c.intake?.category || getDefaultCategoryForIndustry(orgType);

    return {
      id: c.id || uid(),
      createdAt: c.createdAt || new Date().toISOString(),
      stage: c.stage || "SUBMITTED",
      intake: {
        orgType,
        category,
        site: c.intake?.site || "",
        eventDate: c.intake?.eventDate || "",
        reporter: c.intake?.reporter || "",
        title: c.intake?.title || "",
        description: c.intake?.description || "",
        sev0: safeNum(c.intake?.sev0, 3),
        lik0: safeNum(c.intake?.lik0, 3),
        riskLabel: RISK_LABEL(safeNum(c.intake?.sev, 3), safeNum(c.intake?.lik, 3)).label,
      },
      triage: {
        sev: safeNum(c.triage?.sev, 3),
        lik: safeNum(c.triage?.lik, 3),
        riskLabel: c.triage?.riskLabel || "",
        triageNotes: c.triage?.triageNotes || "",
        invRequired: c.triage?.invRequired || "YES",
        notifyLead: c.triage?.notifyLead || "NO",
        investigatorId: c.triage?.investigatorId || ""
      },
      investigation: {
        investigatorId: c.investigation?.investigatorId || "",
        evidence: c.investigation?.evidence || "",
        timeline: c.investigation?.timeline || "",
        findings: c.investigation?.findings || "",
        factors: Array.isArray(c.investigation?.factors) ? c.investigation.factors : []
      },
      intent: {
        q1: c.intent?.q1 || "NO",
        q2: c.intent?.q2 || "NO",
        q3: c.intent?.q3 || "NO",
        q4: c.intent?.q4 || "NO",
        q5: c.intent?.q5 || "NO",
        notes: c.intent?.notes || "",
        outcome: c.intent?.outcome || "",
        rec: c.intent?.rec || ""
      },
      actions: Array.isArray(c.actions) ? c.actions : [],
      srm: {
        hazard: c.srm?.hazard || "",
        controls: c.srm?.controls || "",
        sev: safeNum(c.srm?.sev, 3),
        lik: safeNum(c.srm?.lik, 3),
        risk0: c.srm?.risk0 || "",
        mitigations: c.srm?.mitigations || "",
        sevR: safeNum(c.srm?.sevR, 3),
        likR: safeNum(c.srm?.likR, 3),
        riskR: c.srm?.riskR || "",
        accept: c.srm?.accept || "ACCEPTABLE",
        notes: c.srm?.notes || "",
        riskLabel: c.srm?.riskLabel || ""
      },
      compliance: {
        items: Array.isArray(c.compliance?.items) ? c.compliance.items : [],
        notes: c.compliance?.notes || ""
      },
      osha: {
        injury: c.osha?.injury || "NO",
        recordable: c.osha?.recordable || "NO",
        classification: c.osha?.classification || "OTHER",
        employee: c.osha?.employee || "",
        job: c.osha?.job || "",
        dept: c.osha?.dept || "",
        daysAway: safeNum(c.osha?.daysAway, 0),
        daysRestrict: safeNum(c.osha?.daysRestrict, 0),
        bodyPart: c.osha?.bodyPart || "",
        nature: c.osha?.nature || "",
        where: c.osha?.where || "",
        notes: c.osha?.notes || ""
      },
      closure: {
        sevR: c.closure?.sevR || "3",
        likR: c.closure?.likR || "3",
        notes: c.closure?.notes || "",
        closedAt: c.closure?.closedAt || ""
      }
    };
  };

  // ---------- State ----------
  const loadState = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return DEFAULT_STATE();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return DEFAULT_STATE();

      const users = Array.isArray(parsed.users) && parsed.users.length ? parsed.users : JSON.parse(JSON.stringify(DEFAULT_USERS));
      const policies = Array.isArray(parsed.policies) && parsed.policies.length ? parsed.policies : JSON.parse(JSON.stringify(DEFAULT_POLICIES));
      const cases = Array.isArray(parsed.cases) ? parsed.cases.map(normalizeCase) : [];
      const inspections = Array.isArray(parsed.inspections) ? parsed.inspections : [];
      const activeUserId = users.some(u => u.id === parsed.activeUserId) ? parsed.activeUserId : users[0].id;
      const ui = {
        activeView: parsed.ui?.activeView || "dashboard",
        selectedCaseId: cases.some(c => c.id === parsed.ui?.selectedCaseId) ? parsed.ui.selectedCaseId : (cases[0]?.id || null)
      };

      return { users, activeUserId, policies, cases, inspections, ui };
    } catch {
      return DEFAULT_STATE();
    }
  };

  const state = loadState();

  const saveState = () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save state:", err);
      toast("Could not save data locally.");
    }
  };

  const activeUser = () => state.users.find(u => u.id === state.activeUserId) || state.users[0] || null;

  const selectedCase = () => state.cases.find(c => c.id === state.ui.selectedCaseId) || null;

  const ensureCaseSelected = () => {
    const c = selectedCase();
    if (!c) {
      toast("Select or create a case first.");
      return null;
    }
    return c;
  };

  const caseStageLabel = (stage) => stage || "SUBMITTED";

  // ---------- Validation ----------
  const validateIntakeForm = () => {
    if (!$("#title")?.value.trim()) return "Title is required.";
    if (!$("#description")?.value.trim()) return "Description is required.";
    if (!$("#category")?.value) return "Category is required.";
    if (!$("#site")?.value.trim()) return "Site / Location is required.";
    return "";
  };

  const validateTriageForm = () => {
    if (!$("#triageInvestigator")?.value) return "Assign an investigator.";
    if (!$("#triageNotes")?.value.trim()) return "Triage notes are required.";
    return "";
  };

  const validateInvestigationForm = () => {
    if (!$("#investigator")?.value) return "Investigator is required.";
    if (!$("#findings")?.value.trim()) return "Findings / Root Cause is required.";
    return "";
  };

  const validateActionForm = () => {
    if (!$("#actDesc")?.value.trim()) return "Action description is required.";
    if (!$("#actOwner")?.value) return "Action owner is required.";
    return "";
  };

  const validateInspectionForm = () => {
    if (!$("#inspDate")?.value) return "Inspection date is required.";
    if (!$("#inspArea")?.value.trim()) return "Inspection area is required.";
    if (!$("#inspFindings")?.value.trim()) return "Inspection findings are required.";
    return "";
  };

  // ---------- View/Tabs ----------
  const setView = (viewName) => {
    state.ui.activeView = viewName;
    saveState();

    $$(".tab").forEach(t => {
      const isActive = t.dataset.view === viewName;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    $$(".view").forEach(v => {
      const isTarget = v.id === `view-${viewName}`;
      setPanelVisibility(v, isTarget);
    });

    setPanelVisibility($("#trendsPanel"), viewName === "trends");

    renderAll();
  };

  // ---------- Form Loaders ----------
  const renderFormsFromCase = () => {
    const c = selectedCase();

    populateIndustrySelects();

    if (!c) {
      syncCategoryDropdown("#orgType", "#category");
      syncCategoryDropdown("#dashOrgType", "#dashCategory");

      [
        "#site","#eventDate","#reporter","#title","#description","#sev0","#lik0",
        "#sev","#lik","#triageNotes","#invRequired","#notifyLead","#triageInvestigator",
        "#investigator","#evidence","#timeline","#findings",
        "#intentNotes",
        "#hazard","#controls","#srmSev","#srmLik","#mitigations","#srmSevR","#srmLikR","#srmAccept","#srmNotes",
        "#sevR","#likR","#closeNotes"
      ].forEach(id => setField(id, ""));

      setRadioGroup("q1", "NO");
      setRadioGroup("q2", "NO");
      setRadioGroup("q3", "NO");
      setRadioGroup("q4", "NO");
      setRadioGroup("q5", "NO");

      if ($("#intentOutcomePill")) $("#intentOutcomePill").textContent = "Outcome: —";
      if ($("#intentRecs")) $("#intentRecs").textContent = "";
      if ($("#riskPill")) $("#riskPill").textContent = "Initial Risk: —";
      if ($("#triageRiskPill")) $("#triageRiskPill").textContent = "Risk: —";
      if ($("#srmPill")) $("#srmPill").textContent = "SRM: —";
      return;
    }

    // Intake
    setField("#orgType", c.intake.orgType, "Other");
    syncCategoryDropdown("#orgType", "#category", c.intake.category);
    setField("#site", c.intake.site);
    setField("#eventDate", c.intake.eventDate);
    setField("#reporter", c.intake.reporter);
    setField("#title", c.intake.title);
    setField("#description", c.intake.description);
    setField("#sev0", String(c.intake.sev0 ?? 3), "3");
    setField("#lik0", String(c.intake.lik0 ?? 3), "3");

    // Dashboard quick report defaults
    setField("#dashOrgType", c.intake.orgType, c.intake.orgType);
    syncCategoryDropdown("#dashOrgType", "#dashCategory", c.intake.category);

    // Triage
    setField("#sev", String(c.triage.sev ?? 3), "3");
    setField("#lik", String(c.triage.lik ?? 3), "3");
    setField("#triageNotes", c.triage.triageNotes);
    setField("#invRequired", c.triage.invRequired || "YES", "YES");
    setField("#notifyLead", c.triage.notifyLead || "NO", "NO");
    if ($("#triageInvestigator") && c.triage.investigatorId) $("#triageInvestigator").value = c.triage.investigatorId;

    // Investigation
    if ($("#investigator") && c.investigation.investigatorId) $("#investigator").value = c.investigation.investigatorId;
    setField("#evidence", c.investigation.evidence);
    setField("#timeline", c.investigation.timeline);
    setField("#findings", c.investigation.findings);

    // Intent
    setRadioGroup("q1", c.intent.q1 || "NO");
    setRadioGroup("q2", c.intent.q2 || "NO");
    setRadioGroup("q3", c.intent.q3 || "NO");
    setRadioGroup("q4", c.intent.q4 || "NO");
    setRadioGroup("q5", c.intent.q5 || "NO");
    setField("#intentNotes", c.intent.notes);
    if ($("#intentOutcomePill")) $("#intentOutcomePill").textContent = `Outcome: ${c.intent.outcome || "—"}`;
    if ($("#intentRecs")) $("#intentRecs").textContent = c.intent.rec || "";

    // SRM
    setField("#hazard", c.srm.hazard);
    setField("#controls", c.srm.controls);
    setField("#srmSev", String(c.srm.sev ?? 3), "3");
    setField("#srmLik", String(c.srm.lik ?? 3), "3");
    setField("#mitigations", c.srm.mitigations);
    setField("#srmSevR", String(c.srm.sevR ?? 3), "3");
    setField("#srmLikR", String(c.srm.likR ?? 3), "3");
    setField("#srmAccept", c.srm.accept || "ACCEPTABLE", "ACCEPTABLE");
    setField("#srmNotes", c.srm.notes);

    // Close
    setField("#sevR", String(c.closure.sevR ?? "3"), "3");
    setField("#likR", String(c.closure.likR ?? "3"), "3");
    setField("#closeNotes", c.closure.notes);

    if ($("#riskPill")) $("#riskPill").textContent = `Initial Risk: ${c.intake.riskLabel || "—"}`;
    if ($("#triageRiskPill")) $("#triageRiskPill").textContent = `Risk: ${c.triage.riskLabel || "—"}`;
    if ($("#srmPill")) $("#srmPill").textContent = `SRM: ${c.srm.riskLabel || "—"}`;
  };

  // ---------- Rendering ----------
  const renderUser = () => {
    const u = activeUser();
    if ($("#activeUserName")) $("#activeUserName").textContent = u?.name || "—";
  };

  const renderFilters = () => {
    const ownerSel = $("#filterOwner");
    if (ownerSel) {
      const current = ownerSel.value || "ALL";
      ownerSel.innerHTML =
        `<option value="ALL">All</option>` +
        state.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
      ownerSel.value = [...ownerSel.options].some(o => o.value === current) ? current : "ALL";
    }

    const userOptions = state.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
    syncSelectOptions("#triageInvestigator", userOptions, $("#triageInvestigator")?.value || selectedCase()?.triage?.investigatorId || "");
    syncSelectOptions("#investigator", userOptions, $("#investigator")?.value || selectedCase()?.investigation?.investigatorId || "");
    syncSelectOptions("#actOwner", userOptions, $("#actOwner")?.value || activeUser()?.id || "");
  };

  const renderStats = () => {
    const el = $("#stats");
    if (!el) return;

    const total = state.cases.length;
    const byStage = state.cases.reduce((acc, c) => {
      const s = caseStageLabel(c.stage);
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    el.innerHTML = `
      <div class="stat"><div class="muted">Total Cases</div><div class="h2">${total}</div></div>
      <div class="stat"><div class="muted">Submitted</div><div class="h2">${byStage.SUBMITTED || 0}</div></div>
      <div class="stat"><div class="muted">In Triage</div><div class="h2">${byStage.TRIAGE || 0}</div></div>
      <div class="stat"><div class="muted">Investigation</div><div class="h2">${byStage.INVESTIGATION || 0}</div></div>
      <div class="stat"><div class="muted">Actions</div><div class="h2">${byStage.ACTIONS || 0}</div></div>
      <div class="stat"><div class="muted">Closed</div><div class="h2">${byStage.CLOSED || 0}</div></div>
    `;
  };

  const renderCaseList = () => {
    const list = $("#caseList");
    if (!list) return;

    const q = ($("#search")?.value || "").trim().toLowerCase();
    const stage = $("#filterStage")?.value || "ALL";
    const owner = $("#filterOwner")?.value || "ALL";

    const filtered = state.cases.filter(c => {
      const matchesQ = !q || [
        c.intake.title, c.intake.category, c.intake.site, c.intake.description,
        c.intake.orgType, c.id, c.stage, c.investigation.findings, c.intent.outcome
      ].join(" ").toLowerCase().includes(q);

      const matchesStage = stage === "ALL" || caseStageLabel(c.stage) === stage;

      const matchesOwner =
        owner === "ALL" ||
        (c.actions || []).some(a => a.ownerId === owner) ||
        c.triage.investigatorId === owner ||
        c.investigation.investigatorId === owner;

      return matchesQ && matchesStage && matchesOwner;
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="muted">No cases match your filters.</div>`;
      return;
    }

    list.innerHTML = filtered.map(c => {
      const isSel = c.id === state.ui.selectedCaseId;
      return `
        <div class="item ${isSel ? "active" : ""}" data-case="${escapeHtml(c.id)}">
          <div class="itemTop">
            <div class="itemTitle">${safeText(c.intake.title, "(Untitled)")}</div>
            <div class="pill">${safeText(caseStageLabel(c.stage))}</div>
          </div>
          <div class="muted">${safeText(c.id)} • ${safeText(c.intake.orgType)} • ${safeText(c.intake.category)} • ${safeText(c.intake.site)} • Risk: ${safeText(c.triage.riskLabel || c.intake.riskLabel)}</div>
        </div>
      `;
    }).join("");

    $$("#caseList .item").forEach(it => {
      it.addEventListener("click", () => {
        state.ui.selectedCaseId = it.dataset.case;
        saveState();
        renderAll();
      });
    });
  };

  const renderCaseWorkspace = () => {
    const c = selectedCase();
    const hint = $("#caseHint");
    const pill = $("#stagePill");
    const sum = $("#caseSummary");
    if (!hint || !pill || !sum) return;

    if (!c) {
      hint.textContent = "Create or select a case to begin.";
      pill.textContent = "No case";
      sum.innerHTML = `<div class="muted">Nothing selected.</div>`;
      return;
    }

    const investigatorName =
      state.users.find(u => u.id === (c.investigation.investigatorId || c.triage.investigatorId))?.name || "—";

    hint.textContent = `Working case: ${c.id}`;
    pill.textContent = caseStageLabel(c.stage);

    sum.innerHTML = `
      <div class="row row2">
        <div><div class="muted">Title</div><div class="h3">${safeText(c.intake.title)}</div></div>
        <div><div class="muted">Category</div><div class="h3">${safeText(c.intake.category)}</div></div>
      </div>
      <div class="row row3" style="margin-top:8px">
        <div><div class="muted">Industry</div><div>${safeText(c.intake.orgType)}</div></div>
        <div><div class="muted">Site</div><div>${safeText(c.intake.site)}</div></div>
        <div><div class="muted">Initial Risk</div><div>${safeText(c.intake.riskLabel)}</div></div>
      </div>
      <div style="margin-top:8px" class="muted">
        Investigation: ${safeText(investigatorName)}
        • Intent Outcome: ${safeText(c.intent.outcome)}
        • Actions: ${(c.actions || []).length}
      </div>
    `;
  };

  const renderDashboard = () => {
    const cUser = activeUser();
    if ($("#dashPill")) $("#dashPill").textContent = cUser?.name || "—";

    populateIndustrySelects();
    syncCategoryDropdown("#dashOrgType", "#dashCategory");

    const myActions = [];
    state.cases.forEach(c => {
      (c.actions || []).forEach(a => {
        if (a.ownerId === cUser?.id && a.status !== "Verified") {
          myActions.push({ caseId: c.id, ...a });
        }
      });
    });
const totalCases = state.cases.length;

const openCases = state.cases.filter(c =>
  c.stage !== "Closed"
).length;

const highRiskCases = state.cases.filter(c =>
  c.risk === "High" || c.risk === "Critical"
).length;

const safetyScore = totalCases === 0
  ? 100
  : Math.round(((totalCases - highRiskCases) / totalCases) * 100);

$("#dashSafetyScore").textContent = safetyScore + "%";
$("#dashOpenCases").textContent = openCases;
$("#dashHighRiskCases").textContent = highRiskCases;
$("#dashOpenActions").textContent = myActions.length;
    const myAEl = $("#dashMyActions");
    if (myAEl) {
      myAEl.innerHTML = myActions.length
        ? myActions.map(a => `
            <div class="item">
              <div class="itemTop">
                <div class="itemTitle">${safeText(a.desc, "(No description)")}</div>
                <div class="pill">${safeText(a.status || "Open")}</div>
              </div>
              <div class="muted">${safeText(a.caseId)} • Due: ${safeText(a.due, "—")} • Type: ${safeText(a.type, "—")}</div>
            </div>
          `).join("")
        : `<div class="muted">No open actions assigned to you.</div>`;
    }

    const myCases = state.cases.filter(c =>
      c.triage.investigatorId === cUser?.id || c.investigation.investigatorId === cUser?.id
    );

    const myCEl = $("#dashMyCases");
    if (myCEl) {
      myCEl.innerHTML = myCases.length
        ? myCases.map(c => `
            <div class="item" data-case="${escapeHtml(c.id)}">
              <div class="itemTop">
                <div class="itemTitle">${safeText(c.intake.title, "(Untitled)")}</div>
                <div class="pill">${safeText(caseStageLabel(c.stage))}</div>
              </div>
              <div class="muted">${safeText(c.id)} • ${safeText(c.intake.orgType)} • ${safeText(c.intake.category)} • ${safeText(c.intake.site)}</div>
            </div>
          `).join("")
        : `<div class="muted">No cases assigned to you.</div>`;

      $$("#dashMyCases .item").forEach(it => {
        it.addEventListener("click", () => {
          state.ui.selectedCaseId = it.dataset.case;
          saveState();
          renderAll();
          setView("reports");
          toast("Opened assigned case.");
        });
      });
    }
  };

  const renderFactors = () => {
    const chips = $("#factorChips");
    if (!chips) return;

    const c = selectedCase();
    const selected = new Set(c?.investigation?.factors || []);
    chips.innerHTML = DEFAULT_FACTORS.map(f => {
      const on = selected.has(f);
      return `<button type="button" class="chip ${on ? "on" : ""}" data-factor="${escapeHtml(f)}">${escapeHtml(f)}</button>`;
    }).join("");

    $$("#factorChips .chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const c2 = ensureCaseSelected();
        if (!c2) return;
        const f = btn.dataset.factor;
        const set = new Set(c2.investigation.factors || []);
        if (set.has(f)) set.delete(f);
        else set.add(f);
        c2.investigation.factors = Array.from(set);
        saveState();
        renderFactors();
        toast("Updated factors.");
      });
    });
  };

  const renderActions = () => {
    const list = $("#actionList");
    if (!list) return;
    const c = selectedCase();
    if (!c) {
      list.innerHTML = `<div class="muted">Select a case to view actions.</div>`;
      return;
    }
    const actions = c.actions || [];
    if (!actions.length) {
      list.innerHTML = `<div class="muted">No actions yet.</div>`;
      return;
    }

    list.innerHTML = actions.map(a => {
      const ownerName = state.users.find(u => u.id === a.ownerId)?.name || "Unassigned";
      return `
        <div class="item">
          <div class="itemTop">
            <div class="itemTitle">${safeText(a.desc, "(No description)")}</div>
            <div class="pill">${safeText(a.status || "Open")}</div>
          </div>
          <div class="muted">Owner: ${safeText(ownerName)} • Type: ${safeText(a.type)} • Due: ${safeText(a.due, "—")}</div>
          <div class="row" style="margin-top:8px">
            <button class="btn ghost btnActEdit" data-id="${escapeHtml(a.id)}" type="button">Edit</button>
            <button class="btn danger btnActDel" data-id="${escapeHtml(a.id)}" type="button">Delete</button>
          </div>
        </div>
      `;
    }).join("");

    $$(".btnActDel").forEach(b => {
      b.addEventListener("click", () => {
        const c2 = ensureCaseSelected();
        if (!c2) return;
        c2.actions = (c2.actions || []).filter(a => a.id !== b.dataset.id);
        saveState();
        renderActions();
        renderDashboard();
        renderHeatmaps();
        toast("Action deleted.");
      });
    });

    $$(".btnActEdit").forEach(b => {
      b.addEventListener("click", () => {
        const c2 = ensureCaseSelected();
        if (!c2) return;
        const a = (c2.actions || []).find(x => x.id === b.dataset.id);
        if (!a) return;

        setField("#actType", a.type || "Other");
        setField("#actOwner", a.ownerId || activeUser()?.id || "");
        setField("#actDue", a.due || "");
        setField("#actDesc", a.desc || "");
        setField("#actStatus", a.status || "Open");
        setField("#actVerify", a.verify || "");
        $("#btnAddAction").dataset.editing = a.id;
        toast("Editing action. Click Add Action to save.");
      });
    });
  };

  const renderPolicies = () => {
    const sel = $("#policySelect");
    const txt = $("#policyText");
    if (!sel || !txt) return;

    const currentId = sel.value || state.policies[0]?.id || "";
    sel.innerHTML = state.policies.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");
    const hasCurrent = [...sel.options].some(o => o.value === currentId);
    sel.value = hasCurrent ? currentId : (state.policies[0]?.id || "");

    const pol = state.policies.find(p => p.id === sel.value) || state.policies[0];
    txt.value = pol?.text || "";

    sel.onchange = () => {
      const p = state.policies.find(x => x.id === sel.value);
      txt.value = p?.text || "";
    };
  };

  const renderComplianceChecklist = () => {
    const el = $("#complianceChecklist");
    if (!el) return;

    const items = [
      "FAA Part 141", "FAA Part 135", "SMS Manual", "ERP / Emergency Response",
      "OSHA 29 CFR 1910", "OSHA 29 CFR 1926", "HazCom", "LOTO",
      "PPE", "Training Records", "Maintenance Program", "UAS Ops Manual",
      "Internal Policy", "State/Local Requirements"
    ];

    const c = selectedCase();
    const set = new Set(c?.compliance?.items || []);

    el.innerHTML = items.map(i => {
      const checked = set.has(i) ? "checked" : "";
      return `<label class="check"><input type="checkbox" data-item="${escapeHtml(i)}" ${checked}> ${escapeHtml(i)}</label>`;
    }).join("");

    $$("#complianceChecklist input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const c2 = ensureCaseSelected();
        if (!c2) return;
        const s = new Set(c2.compliance.items || []);
        if (cb.checked) s.add(cb.dataset.item);
        else s.delete(cb.dataset.item);
        c2.compliance.items = Array.from(s);
        saveState();
      });
    });

    if ($("#complianceNotes")) $("#complianceNotes").value = c?.compliance?.notes || "";
  };

  const renderInspectionList = () => {
    const el = $("#inspectionList");
    if (!el) return;

    const currentCaseId = $("#inspCaseId")?.value || state.ui.selectedCaseId || "";
    const list = state.inspections.filter(i => !currentCaseId || i.caseId === currentCaseId);

    if (!list.length) {
      el.innerHTML = `<div class="muted">No inspections logged yet.</div>`;
      return;
    }

    el.innerHTML = list.map(i => `
      <div class="item">
        <div class="itemTop">
          <div class="itemTitle">${safeText(i.type)}</div>
          <div class="pill">${safeText(i.severity)}</div>
        </div>
        <div class="muted">Date: ${safeText(i.date, "—")} • Area: ${safeText(i.area, "—")} • Case: ${safeText(i.caseId, "—")}</div>
        <div style="margin-top:6px">${safeText(i.findings, "").replaceAll("\n", "<br>")}</div>
        <div class="row" style="margin-top:8px">
          <button class="btn danger btnDelInsp" data-id="${escapeHtml(i.id)}" type="button">Delete</button>
        </div>
      </div>
    `).join("");

    $$(".btnDelInsp").forEach(b => {
      b.addEventListener("click", () => {
        state.inspections = state.inspections.filter(x => x.id !== b.dataset.id);
        saveState();
        renderInspectionList();
        toast("Inspection deleted.");
      });
    });
  };

  const renderOsha300Table = () => {
    const tbl = $("#osha300Table tbody");
    if (!tbl) return;

    const rows = state.cases
      .filter(c => c.osha.recordable === "YES")
      .map(c => {
        const o = c.osha;
        const date = c.intake.eventDate || "";
        const desc = c.intake.title || c.intake.description || "";
        const death = o.classification === "DEATH" ? "X" : "";
        const daysAwayCol = o.classification === "DAYS_AWAY" ? "X" : "";
        const transferCol = o.classification === "TRANSFER_RESTRICTION" ? "X" : "";
        const otherCol = o.classification === "OTHER" ? "X" : "";
        return `
          <tr>
            <td>${safeText(c.id, "")}</td>
            <td>${safeText(o.employee, "")}</td>
            <td>${safeText(o.job, "")}</td>
            <td>${safeText((date || "").slice(0, 10), "")}</td>
            <td>${safeText(o.where || c.intake.site, "")}</td>
            <td>${safeText(desc, "")}</td>
            <td>${death}</td>
            <td>${daysAwayCol}</td>
            <td>${transferCol}</td>
            <td>${otherCol}</td>
            <td>${o.daysAway ?? ""}</td>
            <td>${o.daysRestrict ?? ""}</td>
          </tr>
        `;
      });

    tbl.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="12" class="muted">No recordable cases yet.</td></tr>`;
  };

  const renderOSHA = () => {
    const c = selectedCase();
    const where = $("#oshaWhere");
    if (where && c) where.value = c.osha.where || c.intake.site || where.value || "";

    if (!c) {
      [
        "#oshaInjury","#oshaRecordable","#oshaClass","#oshaEmp","#oshaJob","#oshaDept",
        "#oshaDaysAway","#oshaDaysRestrict","#oshaBodyPart","#oshaNature","#oshaWhere","#oshaNotes"
      ].forEach(id => setField(id, ""));
      renderInspectionList();
      renderOsha300Table();
      return;
    }

    const o = c.osha;
    setField("#oshaInjury", o.injury || "NO");
    setField("#oshaRecordable", o.recordable || "NO");
    setField("#oshaClass", o.classification || "OTHER");
    setField("#oshaEmp", o.employee || "");
    setField("#oshaJob", o.job || "");
    setField("#oshaDept", o.dept || "");
    setField("#oshaDaysAway", String(o.daysAway ?? 0));
    setField("#oshaDaysRestrict", String(o.daysRestrict ?? 0));
    setField("#oshaBodyPart", o.bodyPart || "");
    setField("#oshaNature", o.nature || "");
    setField("#oshaWhere", o.where || c.intake.site || "");
    setField("#oshaNotes", o.notes || "");

    const inspCase = $("#inspCaseId");
    if (inspCase && !inspCase.value) inspCase.value = c.id;

    renderInspectionList();
    renderOsha300Table();
  };

  const renderHeatmaps = () => {
    const matrixEl = $("#riskMatrix");
    if (!matrixEl) return;

    const counts = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));

    state.cases.forEach(c => {
      const sev = safeNum(c.triage.sev || c.intake.sev0, 0);
      const lik = safeNum(c.triage.lik || c.intake.lik0, 0);
      if (sev >= 1 && sev <= 5 && lik >= 1 && lik <= 5) {
        counts[sev - 1][lik - 1] += 1;
      }
    });

    let html = `<div class="matrix">`;
    for (let s = 5; s >= 1; s--) {
      html += `<div class="matrixRow">`;
      for (let l = 1; l <= 5; l++) {
        const v = counts[s - 1][l - 1];
        const score = s * l;
let riskClass = "risk-low";

if (score >= 17) riskClass = "risk-critical";
else if (score >= 10) riskClass = "risk-high";
else if (score >= 5) riskClass = "risk-medium";

html += `<div class="matrixCell ${riskClass}" title="S${s}×L${l} Score: ${score}">${v || ""}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    matrixEl.innerHTML = html;

    const by = (keyFn) => {
      const m = new Map();
      state.cases.forEach(c => {
        const k = keyFn(c) || "—";
        m.set(k, (m.get(k) || 0) + 1);
      });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    };

    const siteEl = $("#siteHotspots");
    if (siteEl) {
      const topSites = by(c => c.intake.site);
      siteEl.innerHTML = topSites.length
        ? topSites.map(([k, v]) => `<div class="item"><div class="itemTop"><div class="itemTitle">${safeText(k)}</div><div class="pill">${v}</div></div></div>`).join("")
        : `<div class="muted">No data yet.</div>`;
    }

    const catEl = $("#catHotspots");
    if (catEl) {
      const topCats = by(c => `${c.intake.orgType} / ${c.intake.category}`);
      catEl.innerHTML = topCats.length
        ? topCats.map(([k, v]) => `<div class="item"><div class="itemTop"><div class="itemTitle">${safeText(k)}</div><div class="pill">${v}</div></div></div>`).join("")
        : `<div class="muted">No data yet.</div>`;
    }
  };

  const renderAll = () => {
    renderUser();
    renderFilters();
    renderStats();
    renderCaseList();
    renderCaseWorkspace();
    renderDashboard();
    renderFormsFromCase();
    renderFactors();
    renderActions();
    renderPolicies();
    renderComplianceChecklist();
    renderOSHA();
    renderHeatmaps();
  };

  // ---------- Intent ----------
  const classifyIntent = ({ q1, q2, q3, q4, q5 }) => {
    if (q5 === "YES") {
      return {
        outcome: "Malicious / Sabotage",
        rec: "Immediate security escalation, HR/legal involvement, preserve evidence, zero tolerance."
      };
    }
    if (q1 === "NO") {
      return {
        outcome: "Human Error",
        rec: "Console, coach, train, and strengthen system defenses or procedures."
      };
    }
    if (q1 === "YES" && q2 === "NO") {
      return {
        outcome: "At-Risk Behavior",
        rec: "Coach, reduce drift incentives, improve supervision and clarity."
      };
    }
    if (q2 === "YES" && q3 === "NO") {
      return {
        outcome: "At-Risk (Rule Drift)",
        rec: "Coach, clarify expectations, address norms/workload, and improve SOP clarity."
      };
    }
    if (q3 === "YES" && q4 === "YES") {
      return {
        outcome: "Reckless Behavior",
        rec: "Corrective action, possible discipline, and qualification/fitness review."
      };
    }
    return {
      outcome: "Needs Review",
      rec: "Insufficient info. Convene ERC/SAG and gather more evidence."
    };
  };

  const updateLiveIntentPreview = () => {
    const answers = {
      q1: document.querySelector(`input[name="q1"]:checked`)?.value || "NO",
      q2: document.querySelector(`input[name="q2"]:checked`)?.value || "NO",
      q3: document.querySelector(`input[name="q3"]:checked`)?.value || "NO",
      q4: document.querySelector(`input[name="q4"]:checked`)?.value || "NO",
      q5: document.querySelector(`input[name="q5"]:checked`)?.value || "NO"
    };
    const out = classifyIntent(answers);
    if ($("#intentOutcomePill")) $("#intentOutcomePill").textContent = `Outcome: ${out.outcome}`;
    if ($("#intentRecs")) $("#intentRecs").textContent = out.rec;
  };

  // ---------- Wiring ----------
  const wireIndustryCategorySync = () => {
    $("#orgType")?.addEventListener("change", () => {
      syncCategoryDropdown("#orgType", "#category");
    });

    $("#dashOrgType")?.addEventListener("change", () => {
      syncCategoryDropdown("#dashOrgType", "#dashCategory");
    });
  };

  const wireTabs = () => {
    $$(".tab").forEach(t => {
      t.addEventListener("click", () => setView(t.dataset.view));
    });
  };

  const wireHeaderButtons = () => {
    $("#btnReset")?.addEventListener("click", () => {
      if (!confirm("Reset all offline data?")) return;
      localStorage.removeItem(LS_KEY);
      location.reload();
    });

    $("#btnExportJson")?.addEventListener("click", () => {
      downloadText("safetyos-export.json", JSON.stringify(state, null, 2), "application/json");
      toast("Exported JSON.");
    });

    $("#btnExportCsv")?.addEventListener("click", () => {
      const rows = [
        ["case_id","stage","industry","title","category","site","event_date","risk_initial","risk_triage","intent_outcome","actions_count"],
        ...state.cases.map(c => [
          c.id,
          caseStageLabel(c.stage),
          c.intake.orgType || "",
          c.intake.title || "",
          c.intake.category || "",
          c.intake.site || "",
          c.intake.eventDate || "",
          c.intake.riskLabel || "",
          c.triage.riskLabel || "",
          c.intent.outcome || "",
          String((c.actions || []).length)
        ])
      ].map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");

      downloadText("safetyos-cases.csv", rows, "text/csv");
      toast("Exported CSV.");
    });
  };

  const wireCaseButtons = () => {
    $("#btnNewCase")?.addEventListener("click", () => {
      const id = uid();
      const c = normalizeCase({
        id,
        createdAt: new Date().toISOString(),
        stage: "SUBMITTED",
        intake: {
          orgType: "Airport Operator",
          category: getDefaultCategoryForIndustry("Airport Operator")
        }
      });
      state.cases.unshift(c);
      state.ui.selectedCaseId = id;
      saveState();
      renderAll();
      setView("reports");
      toast("New case created.");
    });

    $("#search")?.addEventListener("input", renderCaseList);
    $("#filterStage")?.addEventListener("change", renderCaseList);
    $("#filterOwner")?.addEventListener("change", renderCaseList);
  };

  const wireDashboardButtons = () => {
    $("#btnDashSubmit")?.addEventListener("click", () => {
      const orgType = $("#dashOrgType")?.value || "Airport Operator";
      const category = $("#dashCategory")?.value || getDefaultCategoryForIndustry(orgType);
      const title = $("#dashTitle")?.value?.trim();
      const description = $("#dashDesc")?.value?.trim();

      if (!title || !description) {
        toast("Enter a title and description.");
        return;
      }

      const id = uid();
      const c = normalizeCase({
        id,
        createdAt: new Date().toISOString(),
        stage: "SUBMITTED",
        intake: {
          orgType,
          category,
          site: "",
          eventDate: "",
          reporter: activeUser()?.name || "",
          title,
          description,
          sev0: 3,
          lik0: 3,
          riskLabel: RISK_LABEL(3, 3).label
        }
      });

      state.cases.unshift(c);
      state.ui.selectedCaseId = id;
      saveState();
      renderAll();

      setField("#dashOrgType", "Airport Operator");
      syncCategoryDropdown("#dashOrgType", "#dashCategory");
      setField("#dashTitle", "");
      setField("#dashDesc", "");

      toast("Quick report submitted.");
    });

    $("#btnDashGoTrends")?.addEventListener("click", () => {
      setView("trends");
      toast("Opened Trends.");
    });
  };

  const wireIntake = () => {
    $("#formIntake")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateIntakeForm();
      if (err) {
        toast(err);
        return;
      }

      const orgType = $("#orgType")?.value || "Other";
      const intake = {
        orgType,
        category: $("#category")?.value || getDefaultCategoryForIndustry(orgType),
        site: $("#site")?.value?.trim() || "",
        eventDate: $("#eventDate")?.value || "",
        reporter: $("#reporter")?.value?.trim() || "",
        title: $("#title")?.value?.trim() || "",
        description: $("#description")?.value?.trim() || "",
        sev0: safeNum($("#sev0")?.value, 3),
        lik0: safeNum($("#lik0")?.value, 3)
      };

      intake.riskLabel = RISK_LABEL(intake.sev0, intake.lik0).label;
      c.intake = { ...c.intake, ...intake };
      c.stage = "SUBMITTED";
      saveState();
      renderAll();
      toast("Intake saved.");
    });

    $("#btnAdvanceFromIntake")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateIntakeForm();
      if (err) {
        toast(err);
        return;
      }

      $("#formIntake")?.requestSubmit();
      c.stage = "TRIAGE";
      saveState();
      setView("triage");
      toast("Advanced to Triage.");
    });
  };

  const wireTriage = () => {
    $("#formTriage")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateTriageForm();
      if (err) {
        toast(err);
        return;
      }

      const sev = safeNum($("#sev")?.value, 3);
      const lik = safeNum($("#lik")?.value, 3);
      const r = RISK_LABEL(sev, lik);

      c.triage = {
        sev,
        lik,
        riskLabel: r.label,
        triageNotes: $("#triageNotes")?.value?.trim() || "",
        invRequired: $("#invRequired")?.value || "YES",
        notifyLead: $("#notifyLead")?.value || "NO",
        investigatorId: $("#triageInvestigator")?.value || ""
      };

      c.stage = "TRIAGE";
      saveState();
      renderAll();
      toast("Triage saved.");
    });

    $("#btnAdvanceFromTriage")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateTriageForm();
      if (err) {
        toast(err);
        return;
      }

      $("#formTriage")?.requestSubmit();
      c.stage = "INVESTIGATION";
      saveState();
      setView("investigate");
      toast("Advanced to Investigation.");
    });
  };

  const wireInvestigation = () => {
    $("#formInvestigation")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateInvestigationForm();
      if (err) {
        toast(err);
        return;
      }

      c.investigation.investigatorId = $("#investigator")?.value || "";
      c.investigation.evidence = $("#evidence")?.value?.trim() || "";
      c.investigation.timeline = $("#timeline")?.value?.trim() || "";
      c.investigation.findings = $("#findings")?.value?.trim() || "";

      c.stage = "INVESTIGATION";
      saveState();
      renderAll();
      toast("Investigation saved.");
    });

    $("#btnAdvanceFromInvestigation")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateInvestigationForm();
      if (err) {
        toast(err);
        return;
      }

      $("#formInvestigation")?.requestSubmit();
      c.stage = "INTENT";
      saveState();
      setView("intent");
      toast("Advanced to Intent.");
    });
  };

  const wireIntent = () => {
    $("#formIntent")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = ensureCaseSelected();
      if (!c) return;

      const answers = {
        q1: document.querySelector(`input[name="q1"]:checked`)?.value || "NO",
        q2: document.querySelector(`input[name="q2"]:checked`)?.value || "NO",
        q3: document.querySelector(`input[name="q3"]:checked`)?.value || "NO",
        q4: document.querySelector(`input[name="q4"]:checked`)?.value || "NO",
        q5: document.querySelector(`input[name="q5"]:checked`)?.value || "NO"
      };

      const out = classifyIntent(answers);

      c.intent = {
        ...answers,
        notes: $("#intentNotes")?.value?.trim() || "",
        outcome: out.outcome,
        rec: out.rec
      };

      c.stage = "INTENT";
      saveState();
      renderAll();
      toast("Intent outcome saved.");
    });

    $("#btnAdvanceFromIntent")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;
      $("#formIntent")?.requestSubmit();
      c.stage = "ACTIONS";
      saveState();
      setView("actions");
      toast("Advanced to Actions.");
    });

    ["q1","q2","q3","q4","q5"].forEach(name => {
      $$(`input[name="${name}"]`).forEach(r => {
        r.addEventListener("change", updateLiveIntentPreview);
      });
    });
  };

  const wireActions = () => {
    $("#btnAddAction")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      const err = validateActionForm();
      if (err) {
        toast(err);
        return;
      }

      const editingId = $("#btnAddAction")?.dataset.editing || "";

      const action = {
        id: editingId || uid(),
        type: $("#actType")?.value || "Other",
        ownerId: $("#actOwner")?.value || activeUser()?.id || "",
        due: $("#actDue")?.value || "",
        desc: $("#actDesc")?.value?.trim() || "",
        status: $("#actStatus")?.value || "Open",
        verify: $("#actVerify")?.value?.trim() || ""
      };

      if (editingId) {
        const idx = c.actions.findIndex(a => a.id === editingId);
        if (idx >= 0) c.actions[idx] = action;
        delete $("#btnAddAction").dataset.editing;
        toast("Action updated.");
      } else {
        c.actions.unshift(action);
        toast("Action added.");
      }

      saveState();
      renderActions();
      renderDashboard();

      setField("#actType", "Procedure");
      setField("#actOwner", activeUser()?.id || "");
      setField("#actDue", "");
      setField("#actDesc", "");
      setField("#actStatus", "Open");
      setField("#actVerify", "");
    });

    $("#btnGoSRM")?.addEventListener("click", () => {
      setView("risk");
      toast("Opened SRM.");
    });

    $("#btnCloseCase")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      c.closure = {
        sevR: $("#sevR")?.value || "3",
        likR: $("#likR")?.value || "3",
        notes: $("#closeNotes")?.value?.trim() || "",
        closedAt: new Date().toISOString()
      };
      c.stage = "CLOSED";
      saveState();
      renderAll();
      toast("Case closed.");
    });
  };

  const wireSRM = () => {
    $("#formSRM")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const c = ensureCaseSelected();
      if (!c) return;

      const s0 = safeNum($("#srmSev")?.value, 3);
      const l0 = safeNum($("#srmLik")?.value, 3);
      const sR = safeNum($("#srmSevR")?.value, 3);
      const lR = safeNum($("#srmLikR")?.value, 3);

      const r0 = RISK_LABEL(s0, l0).label;
      const rR = RISK_LABEL(sR, lR).label;

      c.srm = {
        hazard: $("#hazard")?.value?.trim() || "",
        controls: $("#controls")?.value?.trim() || "",
        sev: s0,
        lik: l0,
        risk0: r0,
        mitigations: $("#mitigations")?.value?.trim() || "",
        sevR: sR,
        likR: lR,
        riskR: rR,
        accept: $("#srmAccept")?.value || "ACCEPTABLE",
        notes: $("#srmNotes")?.value?.trim() || "",
        riskLabel: rR
      };

      saveState();
      renderAll();
      toast("SRM saved.");
    });

    $("#btnSRMToActions")?.addEventListener("click", () => {
      setView("actions");
      toast("Back to Actions.");
    });
  };

  const wireCompliance = () => {
    $("#btnSavePolicy")?.addEventListener("click", () => {
      const sel = $("#policySelect");
      const txt = $("#policyText");
      if (!sel || !txt) return;
      const p = state.policies.find(x => x.id === sel.value);
      if (p) p.text = txt.value;
      saveState();
      toast("Policy saved.");
    });

    $("#btnSaveCompliance")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;
      c.compliance.notes = $("#complianceNotes")?.value?.trim() || "";
      saveState();
      toast("Compliance saved.");
    });
  };

  const wireOSHA = () => {
    $("#btnAutoFillOSHA")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      setField("#oshaWhere", c.intake.site || $("#oshaWhere")?.value || "");
      setField("#oshaNature", $("#oshaNature")?.value || c.intake.title || "");
      toast("Auto-filled from case.");
    });

    $("#btnSaveOSHA")?.addEventListener("click", () => {
      const c = ensureCaseSelected();
      if (!c) return;

      c.osha = {
        injury: $("#oshaInjury")?.value || "NO",
        recordable: $("#oshaRecordable")?.value || "NO",
        classification: $("#oshaClass")?.value || "OTHER",
        employee: $("#oshaEmp")?.value?.trim() || "",
        job: $("#oshaJob")?.value?.trim() || "",
        dept: $("#oshaDept")?.value?.trim() || "",
        daysAway: $("#oshaDaysAway")?.value ? safeNum($("#oshaDaysAway").value, 0) : 0,
        daysRestrict: $("#oshaDaysRestrict")?.value ? safeNum($("#oshaDaysRestrict").value, 0) : 0,
        bodyPart: $("#oshaBodyPart")?.value?.trim() || "",
        nature: $("#oshaNature")?.value?.trim() || "",
        where: $("#oshaWhere")?.value?.trim() || "",
        notes: $("#oshaNotes")?.value?.trim() || ""
      };

      saveState();
      renderOsha300Table();
      toast("OSHA saved.");
    });

    $("#btnRenderOshaTable")?.addEventListener("click", () => {
      renderOsha300Table();
      toast("OSHA 300 refreshed.");
    });

    $("#btnGenOsha300Csv")?.addEventListener("click", () => {
      const rows = [
        ["Case","Employee","Job Title","Date","Where","Description","Death","DaysAwayCol","TransferRestrictCol","OtherCol","DaysAway","DaysRestrict"]
      ];

      state.cases
        .filter(c => c.osha.recordable === "YES")
        .forEach(c => {
          const o = c.osha;
          rows.push([
            c.id,
            o.employee || "",
            o.job || "",
            (c.intake.eventDate || "").slice(0, 10),
            o.where || c.intake.site || "",
            c.intake.title || c.intake.description || "",
            o.classification === "DEATH" ? "X" : "",
            o.classification === "DAYS_AWAY" ? "X" : "",
            o.classification === "TRANSFER_RESTRICTION" ? "X" : "",
            o.classification === "OTHER" ? "X" : "",
            String(o.daysAway ?? 0),
            String(o.daysRestrict ?? 0)
          ]);
        });

      const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
      if ($("#oshaOut")) $("#oshaOut").value = csv;
      toast("OSHA CSV generated.");
    });

    $("#btnAddInspection")?.addEventListener("click", () => {
      const err = validateInspectionForm();
      if (err) {
        toast(err);
        return;
      }

      state.inspections.unshift({
        id: uid(),
        type: $("#inspType")?.value || "Internal Self-Inspection",
        lead: $("#inspLead")?.value?.trim() || "",
        date: $("#inspDate")?.value || "",
        area: $("#inspArea")?.value?.trim() || "",
        caseId: $("#inspCaseId")?.value?.trim() || "",
        checklist: $("#inspChecklist")?.value?.trim() || "",
        findings: $("#inspFindings")?.value?.trim() || "",
        citations: $("#inspCitations")?.value?.trim() || "",
        severity: $("#inspSeverity")?.value || "Low",
        due: $("#inspDue")?.value || ""
      });

      saveState();
      renderInspectionList();

      setField("#inspChecklist", "");
      setField("#inspFindings", "");
      setField("#inspCitations", "");

      toast("Inspection added.");
    });
  };

  const wireHeatmaps = () => {
    $("#btnRefreshHeatmaps")?.addEventListener("click", () => {
      renderHeatmaps();
      toast("Heatmaps refreshed.");
    });
  };

  const wireTrends = () => {
    $("#btnGenerateTrends")?.addEventListener("click", () => {
      const n = state.cases.length;

      const topCats = state.cases.reduce((m, c) => {
        const k = `${c.intake.orgType || "—"} / ${c.intake.category || "—"}`;
        m[k] = (m[k] || 0) + 1;
        return m;
      }, {});

      const factorCounts = {};
      state.cases.forEach(c => {
        (c.investigation.factors || []).forEach(f => {
          factorCounts[f] = (factorCounts[f] || 0) + 1;
        });
      });

      const topCategories = Object.entries(topCats).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const topFactors = Object.entries(factorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const highRiskCases = state.cases.filter(c => (c.triage.riskLabel || c.intake.riskLabel) === "High").length;
      const closedCases = state.cases.filter(c => c.stage === "CLOSED").length;
      const openActions = state.cases.reduce((sum, c) => sum + (c.actions || []).filter(a => a.status !== "Verified").length, 0);

      const out =
`SAFETYOS – TREND SUMMARY (Offline MVP)
Cases analyzed: ${n}
Closed cases: ${closedCases}
Open / unverified actions: ${openActions}
High-risk cases: ${highRiskCases}

Top Industry / Category Hotspots:
${topCategories.length ? topCategories.map(([k, v]) => `- ${k}: ${v}`).join("\n") : "- No category data yet."}

Top Contributing Factors:
${topFactors.length ? topFactors.map(([k, v]) => `- ${k}: ${v}`).join("\n") : "- No factor tags yet."}

Recommended Actions:
1) If one industry/category combination repeats, create a targeted mitigation playbook.
2) If high-risk cases cluster at one site, run SRM and add engineered or procedural controls.
3) If Human Error or At-Risk outcomes dominate, improve training, supervision, and reporting clarity.
4) Review overdue CAPA items weekly and escalate stagnant actions.
5) Tag contributing factors consistently in investigations to improve trend quality.

Note: This is offline demo "AI-style" output. Replace with a real AI service later.
`;
      if ($("#trendOut")) $("#trendOut").value = out;
      toast("Trends generated.");
    });

    $("#btnCopyTrend")?.addEventListener("click", async () => {
      const t = $("#trendOut")?.value || "";
      if (!t) {
        toast("Nothing to copy.");
        return;
      }
      try {
        await navigator.clipboard.writeText(t);
        toast("Copied.");
      } catch {
        toast("Copy blocked by browser.");
      }
    });
  };

  // ---------- Login Modal ----------
  const openLogin = () => {
    const modal = $("#loginModal");
    if (!modal) return;
    setPanelVisibility(modal, true);
    renderUserList();
  };

  const closeLogin = () => {
    const modal = $("#loginModal");
    if (!modal) return;
    setPanelVisibility(modal, false);
  };

  const renderUserList = () => {
    const list = $("#userList");
    if (!list) return;

    list.innerHTML = state.users.map(u => `
      <div class="item">
        <div class="itemTop">
          <div class="itemTitle">${safeText(u.name)}</div>
          <div class="pill">PIN ${safeText(u.pin)}</div>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn primary btnPickUser" data-id="${escapeHtml(u.id)}" type="button">Use</button>
          <button class="btn danger btnDelUser" data-id="${escapeHtml(u.id)}" type="button">Delete</button>
        </div>
      </div>
    `).join("");

    $$(".btnPickUser").forEach(b => {
      b.addEventListener("click", () => {
        state.activeUserId = b.dataset.id;
        saveState();
        renderAll();
        closeLogin();
        toast("User switched.");
      });
    });

    $$(".btnDelUser").forEach(b => {
      b.addEventListener("click", () => {
        if (state.users.length <= 1) {
          toast("Need at least one user.");
          return;
        }

        const idToDelete = b.dataset.id;
        const fallbackUser = state.users.find(u => u.id !== idToDelete);
        if (!fallbackUser) {
          toast("Need at least one user.");
          return;
        }

        state.cases.forEach(c => {
          if (c.triage.investigatorId === idToDelete) c.triage.investigatorId = fallbackUser.id;
          if (c.investigation.investigatorId === idToDelete) c.investigation.investigatorId = fallbackUser.id;
          (c.actions || []).forEach(a => {
            if (a.ownerId === idToDelete) a.ownerId = fallbackUser.id;
          });
        });

        state.users = state.users.filter(u => u.id !== idToDelete);
        if (state.activeUserId === idToDelete) state.activeUserId = fallbackUser.id;

        saveState();
        renderAll();
        renderUserList();
        toast("User deleted and assignments reassigned.");
      });
    });
  };

  const wireLogin = () => {
    $("#btnLogin")?.addEventListener("click", openLogin);
    $("#btnCloseLogin")?.addEventListener("click", closeLogin);

    $("#btnAddUser")?.addEventListener("click", () => {
      const name = $("#newUserName")?.value?.trim() || "";
      const pin = $("#newUserPin")?.value?.trim() || "";

      if (!name || !/^\d{4}$/.test(pin)) {
        toast("Enter name and 4-digit PIN.");
        return;
      }

      state.users.push({ id: uid(), name, pin });
      saveState();
      renderAll();
      renderUserList();
      setField("#newUserName", "");
      setField("#newUserPin", "");
      toast("User added.");
    });
  };

  // ---------- Boot ----------
  const boot = () => {
    wireIndustryCategorySync();
    wireTabs();
    wireHeaderButtons();
    wireCaseButtons();
    wireDashboardButtons();
    wireIntake();
    wireTriage();
    wireInvestigation();
    wireIntent();
    wireActions();
    wireSRM();
    wireCompliance();
    wireOSHA();
    wireHeatmaps();
    wireTrends();
    wireLogin();

    populateIndustrySelects();
    syncCategoryDropdown("#orgType", "#category");
    syncCategoryDropdown("#dashOrgType", "#dashCategory");

    setView(state.ui.activeView || "dashboard");
    renderAll();
    updateLiveIntentPreview();
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
