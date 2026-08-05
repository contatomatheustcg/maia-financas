import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Eye, EyeOff, Bell, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X,
  Search, TrendingUp, TrendingDown, Target, PieChart as PieIcon, Diamond,
  Mail, Lock, LogOut, Shield, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight, Save, Sparkles,
  Check, SkipForward, CalendarClock,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import {
  fetchAllData, insertEntry, updateEntry, patchEntry, deleteEntry,
  insertCategory, seedCategories, updateCategory, deleteCategory,
  upsertSettings, describeSupabaseError,
} from "./lib/db";

/* ---------------------------------------------------------------------- */
/*  Tokens — inspired by the reference dashboard (navy header + white UI)  */
/* ---------------------------------------------------------------------- */

const COLORS = {
  page: "#F3F4FA",
  navy1: "#14162B",
  navy2: "#1E2142",
  card: "#FFFFFF",
  cardBorder: "rgba(20,22,43,0.06)",
  ink900: "#1B1E3A",
  ink600: "#6B6F8C",
  ink400: "#A0A3BD",
  primary: "#6C5CE0",
  primarySoft: "rgba(108,92,224,0.10)",
  income: "#0F9C8D",
  incomeSoft: "rgba(15,156,141,0.10)",
  expense: "#E8556B",
  expenseSoft: "rgba(232,85,107,0.10)",
  invest: "#E0A23C",
  investSoft: "rgba(224,162,60,0.12)",
  healthYellow: "#E3B93C",
  healthYellowSoft: "rgba(227,185,60,0.14)",
};

/* Health-of-the-month color scale: green (healthy) -> yellow -> orange -> red (critical),
   driven by how much of the income has been spent this month. */
function getHealthStatus(expensePercent, saldoCents) {
  if (saldoCents < 0 || expensePercent >= 90) {
    return { color: COLORS.expense, soft: COLORS.expenseSoft, dark: "#3D1620", label: "Crítico" };
  }
  if (expensePercent >= 75) {
    return { color: COLORS.invest, soft: COLORS.investSoft, dark: "#3D2A10", label: "Apertado" };
  }
  if (expensePercent >= 60) {
    return { color: COLORS.healthYellow, soft: COLORS.healthYellowSoft, dark: "#3A3410", label: "Atenção" };
  }
  return { color: COLORS.income, soft: COLORS.incomeSoft, dark: "#0E3B30", label: "Saudável" };
}

const DEFAULT_VARIABLE_CATEGORIES = [
  { id: "mercado", label: "Mercado", color: "#C15FA0" },
  { id: "servico_basico", label: "Serviço básico", color: "#4E8FA8" },
  { id: "contas", label: "Contas", color: "#3D7FC9" },
  { id: "carro", label: "Carro", color: "#E8556B" },
  { id: "saude", label: "Saúde", color: "#8B5FC9" },
  { id: "lazer", label: "Lazer", color: "#E0A23C" },
  { id: "outros", label: "Outros", color: "#B4638A" },
];

const DEFAULT_FIXED_CATEGORIES = [
  { id: "moradia", label: "Moradia", color: "#8C6239" },
  { id: "contas", label: "Contas", color: "#3D7FC9" },
  { id: "transporte", label: "Transporte", color: "#E8556B" },
  { id: "saude", label: "Saúde", color: "#8B5FC9" },
  { id: "assinaturas", label: "Assinaturas", color: "#E0A23C" },
  { id: "outros", label: "Outros", color: "#B4638A" },
];

const INVEST_CATEGORY_PALETTE = [
  { id: "renda_fixa", label: "Renda Fixa", color: "#0F9C8D" },
  { id: "acoes", label: "Ações", color: "#3D7FC9" },
  { id: "fundos_imobiliarios", label: "Fundos Imobiliários", color: "#E0A23C" },
  { id: "reserva_emergencia", label: "Reserva de Emergência", color: "#8B5FC9" },
  { id: "outros_investimentos", label: "Outros", color: "#B4638A" },
];

const INCOME_CATEGORY_PALETTE = [
  { id: "fixa", label: "Fixa", color: "#0F9C8D" },
  { id: "variavel", label: "Variável", color: "#3D7FC9" },
  { id: "extra", label: "Extra", color: "#E0A23C" },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const brl = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatDateShort = (iso) => {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}`;
};
const todayShort = () => formatDateShort(todayISO());

/* -------------------------- month navigation (real calendar months) -------------------------- */

function monthKeyFromOffset(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabelFromOffset(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function monthsBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function daysUntilDue(dueDay) {
  if (!dueDay) return null;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let diff = dueDay - now.getDate();
  if (diff < 0) diff += daysInMonth;
  return diff;
}

function dueLabel(days) {
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

/* ---------------------------------------------------------------------- */
/*  Presentational helpers (no hooks -> safe to early-return)              */
/* ---------------------------------------------------------------------- */

function Modal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0" style={{ background: "rgba(20,22,43,0.35)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 pb-8 sm:pb-6"
        style={{ background: COLORS.card, boxShadow: "0 24px 60px rgba(20,22,43,0.2)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: COLORS.ink900 }}>{title}</h3>
            {subtitle && <p className="text-sm mt-0.5" style={{ color: COLORS.ink600 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{ background: COLORS.page }} aria-label="Fechar">
            <X size={16} style={{ color: COLORS.ink600 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CurrencyInput({ valueCents, onChange, autoFocus }) {
  const display = (valueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    onChange(digits === "" ? 0 : parseInt(digits, 10));
  };
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
      <span style={{ color: COLORS.ink400, fontSize: 14 }}>R$</span>
      <input
        autoFocus={autoFocus}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className="w-full bg-transparent outline-none text-base"
        style={{ color: COLORS.ink900 }}
      />
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2.5 outline-none text-base"
      style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
    />
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, hide, footer }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          {React.cloneElement(icon, { size: 15, color: iconColor })}
        </div>
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color: COLORS.ink900 }}>{hide ? "R$ ••••" : value}</div>
      {footer}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  App                                                                    */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const settingsHydratedRef = useRef(false);

  const user = session?.user || null;
  const isAuthenticated = !!session;
  const userName = user?.user_metadata?.name || (user?.email ? user.email.split("@")[0] : "");

  const [authView, setAuthView] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupConfirmationSent, setSignupConfirmationSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const [section, setSection] = useState("overview");
  const [budgetTab, setBudgetTab] = useState("variavel");
  const [hideAmounts, setHideAmounts] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const currentMonthKey = monthKeyFromOffset(monthOffset);
  const currentMonthLabel = monthLabelFromOffset(monthOffset);
  const [search, setSearch] = useState("");

  const [income, setIncome] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [variableExpenses, setVariableExpenses] = useState([]);

  const [investPercent, setInvestPercent] = useState(0);
  const [investModalOpen, setInvestModalOpen] = useState(false);
  const [tempInvestPercent, setTempInvestPercent] = useState(0);
  const [tempInvestAmountCents, setTempInvestAmountCents] = useState(0);
  const [investAmountEditing, setInvestAmountEditing] = useState(false);
  const [investAllocations, setInvestAllocations] = useState([]);

  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [variableCategories, setVariableCategories] = useState(DEFAULT_VARIABLE_CATEGORIES);
  const [fixedCategories, setFixedCategories] = useState(DEFAULT_FIXED_CATEGORIES);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalTarget, setCategoryModalTarget] = useState("variavel");
  const [categoryEditingId, setCategoryEditingId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6C5CE0");
  const [previousMonthSnapshot, setPreviousMonthSnapshot] = useState(null);
  const [projectionMonths, setProjectionMonths] = useState("12");
  const [projectionRate, setProjectionRate] = useState("0.8");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState("variavel");
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formAmountCents, setFormAmountCents] = useState(0);
  const [formCategory, setFormCategory] = useState("mercado");
  const [formError, setFormError] = useState("");
  const [formRecurrenceType, setFormRecurrenceType] = useState("fixo");
  const [formInstallmentCurrent, setFormInstallmentCurrent] = useState("1");
  const [formInstallmentTotal, setFormInstallmentTotal] = useState("2");
  const [formDueDay, setFormDueDay] = useState("");
  const [formPaymentDate, setFormPaymentDate] = useState("");
  const [formPaidStatus, setFormPaidStatus] = useState("aberto");

  /* -------------------------- auth session -------------------------- */

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthChecking(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  /* -------------------------- load / reset finance data -------------------------- */

  useEffect(() => {
    if (!user) {
      setIncome([]);
      setFixedExpenses([]);
      setVariableExpenses([]);
      setInvestAllocations([]);
      setVariableCategories(DEFAULT_VARIABLE_CATEGORIES);
      setFixedCategories(DEFAULT_FIXED_CATEGORIES);
      setInvestPercent(0);
      setCategoryBudgets({});
      settingsHydratedRef.current = false;
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    fetchAllData(user.id)
      .then(async (d) => {
        if (cancelled) return;
        setIncome(d.income);
        setFixedExpenses(d.fixedExpenses);
        setVariableExpenses(d.variableExpenses);
        setInvestAllocations(d.investAllocations);

        let varCats = d.variableCategories;
        let fixedCats = d.fixedCategories;
        // Categorias padrão só são copiadas pro banco na primeira vez — depois disso,
        // o banco é a única fonte de verdade (permite editar/excluir até as padrão).
        if (!d.settings.categoriesSeeded) {
          await Promise.all([
            seedCategories("variavel", DEFAULT_VARIABLE_CATEGORIES, user.id),
            seedCategories("fixa", DEFAULT_FIXED_CATEGORIES, user.id),
          ]);
          varCats = [...DEFAULT_VARIABLE_CATEGORIES, ...varCats];
          fixedCats = [...DEFAULT_FIXED_CATEGORIES, ...fixedCats];
          await upsertSettings(user.id, {
            investPercent: d.settings.investPercent,
            categoryBudgets: d.settings.categoryBudgets,
            categoriesSeeded: true,
          });
        }
        if (cancelled) return;
        setVariableCategories(varCats);
        setFixedCategories(fixedCats);
        setInvestPercent(d.settings.investPercent);
        setCategoryBudgets(d.settings.categoryBudgets);
        settingsHydratedRef.current = true;
      })
      .catch((e) => console.error("Falha ao carregar dados do Supabase:", e))
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /* -------------------------- persist settings (debounced) -------------------------- */

  useEffect(() => {
    if (!user || !settingsHydratedRef.current) return;
    const handle = setTimeout(() => {
      upsertSettings(user.id, { investPercent, categoryBudgets }).catch((e) =>
        console.error("Falha ao salvar configurações:", e)
      );
    }, 600);
    return () => clearTimeout(handle);
  }, [investPercent, categoryBudgets, user?.id]);

  /* -------------------------- derived totals -------------------------- */

  const monthIncome = useMemo(
    () => income.filter((i) => i.referenceMonth === currentMonthKey),
    [income, currentMonthKey]
  );
  const monthVariableExpenses = useMemo(
    () => variableExpenses.filter((e) => e.referenceMonth === currentMonthKey),
    [variableExpenses, currentMonthKey]
  );
  const activeFixedForMonth = useMemo(() => {
    return fixedExpenses
      .map((def) => {
        const offset = monthsBetween(def.startMonth, currentMonthKey);
        if (offset < 0) return null;
        let installment = def.installment;
        if (installment) {
          const effectiveCurrent = installment.current + offset;
          if (effectiveCurrent > installment.total) return null;
          installment = { current: effectiveCurrent, total: installment.total };
        }
        const status = def.paidMonths?.[currentMonthKey] || {};
        return { ...def, installment, paid: !!status.paid, paymentDate: status.paymentDate || null };
      })
      .filter(Boolean);
  }, [fixedExpenses, currentMonthKey]);

  const totalIncome = useMemo(() => monthIncome.reduce((s, i) => s + i.amountCents, 0), [monthIncome]);
  const totalFixed = useMemo(() => activeFixedForMonth.reduce((s, i) => s + i.amountCents, 0), [activeFixedForMonth]);
  const totalVariable = useMemo(() => monthVariableExpenses.filter((i) => !i.deferred).reduce((s, i) => s + i.amountCents, 0), [monthVariableExpenses]);
  const totalExpenses = totalFixed + totalVariable;
  const investAmountCents = Math.round((totalIncome * investPercent) / 100);
  const saldoCents = totalIncome - investAmountCents - totalExpenses;
  const expensePercentOfIncome = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  const healthStatus = getHealthStatus(expensePercentOfIncome, saldoCents);

  const categoryBreakdown = useMemo(() => {
    const byCat = {};
    monthVariableExpenses.filter((e) => !e.deferred).forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amountCents; });
    return Object.entries(byCat)
      .map(([catId, value]) => ({ ...(variableCategories.find((c) => c.id === catId) || variableCategories.find((c) => c.id === "outros") || variableCategories[variableCategories.length - 1]), value }))
      .sort((a, b) => b.value - a.value);
  }, [monthVariableExpenses]);

  const FIXED_ITEM_COLORS = ["#0F9C8D", "#3D7FC9", "#E8556B", "#8B5FC9", "#E0A23C", "#B4638A"];
  const fixedBreakdown = useMemo(() => {
    return activeFixedForMonth
      .slice()
      .sort((a, b) => b.amountCents - a.amountCents)
      .map((e, idx) => ({ id: e.id, label: e.name, color: FIXED_ITEM_COLORS[idx % FIXED_ITEM_COLORS.length], value: e.amountCents }));
  }, [activeFixedForMonth]);

  const allocatedTotal = useMemo(() => investAllocations.reduce((s, i) => s + i.amountCents, 0), [investAllocations]);
  const remainingToAllocate = investAmountCents - allocatedTotal;

  const investBreakdown = useMemo(() => {
    const byCat = {};
    investAllocations.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amountCents; });
    return Object.entries(byCat)
      .map(([catId, value]) => ({ ...(INVEST_CATEGORY_PALETTE.find((c) => c.id === catId) || INVEST_CATEGORY_PALETTE[4]), value }))
      .sort((a, b) => b.value - a.value);
  }, [investAllocations]);

  const incomeUsageBreakdown = useMemo(() => {
    const byLabel = {};
    const addSlice = (label, value, color) => {
      if (value <= 0) return;
      if (!byLabel[label]) byLabel[label] = { id: label, label, value: 0, color };
      byLabel[label].value += value;
    };
    activeFixedForMonth.forEach((e) => {
      const cat = fixedCategories.find((c) => c.id === e.category) || fixedCategories.find((c) => c.id === "outros") || fixedCategories[fixedCategories.length - 1];
      addSlice(cat.label, e.amountCents, cat.color);
    });
    monthVariableExpenses.filter((e) => !e.deferred).forEach((e) => {
      const cat = variableCategories.find((c) => c.id === e.category) || variableCategories.find((c) => c.id === "outros") || variableCategories[variableCategories.length - 1];
      addSlice(cat.label, e.amountCents, cat.color);
    });
    addSlice("Investimento", investAmountCents, COLORS.invest);
    const slices = Object.values(byLabel).sort((a, b) => b.value - a.value);
    const used = slices.reduce((s, x) => s + x.value, 0);
    const free = totalIncome - used;
    if (free > 0) slices.push({ id: "livre", label: "Livre", value: free, color: COLORS.income });
    return slices;
  }, [activeFixedForMonth, monthVariableExpenses, investAmountCents, totalIncome]);

  const emergencyReserveCents = useMemo(
    () => investAllocations.filter((a) => a.category === "reserva_emergencia").reduce((s, a) => s + a.amountCents, 0),
    [investAllocations]
  );
  const emergencyMonthsCoverage = totalFixed > 0 ? emergencyReserveCents / totalFixed : 0;
  const emergencyGoalMonths = 6;

  const subscriptionsMonthlyCents = useMemo(
    () => activeFixedForMonth.filter((e) => e.subscription).reduce((s, e) => s + e.amountCents, 0),
    [activeFixedForMonth]
  );
  const subscriptionsAnnualCents = subscriptionsMonthlyCents * 12;
  const activeSubscriptionsCount = activeFixedForMonth.filter((e) => e.subscription).length;

  const upcomingDue = useMemo(() => {
    return activeFixedForMonth
      .filter((e) => e.dueDay && !e.paid)
      .map((e) => ({ ...e, daysLeft: daysUntilDue(e.dueDay) }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [activeFixedForMonth]);

  const projectedFutureValueCents = useMemo(() => {
    const months = Math.max(0, parseInt(projectionMonths, 10) || 0);
    const rate = (parseFloat(projectionRate.replace(",", ".")) || 0) / 100;
    if (investAmountCents <= 0 || months === 0) return 0;
    if (rate === 0) return investAmountCents * months;
    const fv = investAmountCents * ((Math.pow(1 + rate, months) - 1) / rate);
    return Math.round(fv);
  }, [investAmountCents, projectionMonths, projectionRate]);
  const projectedContributedCents = Math.max(0, parseInt(projectionMonths, 10) || 0) * investAmountCents;
  const projectedGainCents = projectedFutureValueCents - projectedContributedCents;

  function saveMonthSnapshot() {
    setPreviousMonthSnapshot({ label: currentMonthLabel, totalIncome, totalExpenses, saldoCents });
  }

  const monthComparison = useMemo(() => {
    if (!previousMonthSnapshot) return null;
    const pct = (curr, prev) => (prev === 0 ? null : Math.round(((curr - prev) / Math.abs(prev)) * 100));
    return {
      incomeDelta: pct(totalIncome, previousMonthSnapshot.totalIncome),
      expenseDelta: pct(totalExpenses, previousMonthSnapshot.totalExpenses),
      saldoDelta: pct(saldoCents, previousMonthSnapshot.saldoCents),
    };
  }, [previousMonthSnapshot, totalIncome, totalExpenses, saldoCents]);

  const isOverview = section === "overview";
  const isBudget = section === "budget";
  const isInvest = section === "invest";
  const isReceitaTab = isBudget && budgetTab === "receita";
  const isFixaTab = isBudget && budgetTab === "fixa";
  const isVariavelTab = isBudget && budgetTab === "variavel";
  const rows = budgetTab === "receita" ? monthIncome : budgetTab === "fixa" ? activeFixedForMonth : monthVariableExpenses;
  const rowsTotal = budgetTab === "receita" ? totalIncome : budgetTab === "fixa" ? totalFixed : totalVariable;
  const rowsTone = budgetTab === "receita" ? "income" : "expense";
  const tabLabel = { receita: "Receita", fixa: "Despesa fixa", variavel: "Despesa variável" };

  const overviewRows = useMemo(() => [
    ...monthIncome.map((r) => ({ ...r, kind: "receita" })),
    ...activeFixedForMonth.map((r) => ({ ...r, kind: "fixa" })),
    ...monthVariableExpenses.map((r) => ({ ...r, kind: "variavel" })),
    ...investAllocations.map((r) => ({ ...r, kind: "investimento" })),
  ], [monthIncome, activeFixedForMonth, monthVariableExpenses, investAllocations]);

  const tableSource = isOverview ? overviewRows : isInvest ? investAllocations : rows;
  const tableRows = tableSource.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  const balanceLabel = isOverview
    ? "Saldo do mês"
    : isInvest
    ? "Investido este mês"
    : budgetTab === "receita" ? "Total em receitas" : budgetTab === "fixa" ? "Total em despesas fixas" : "Total em despesas variáveis";
  const balanceValue = isOverview ? saldoCents : isInvest ? investAmountCents : rowsTotal;
  const balanceTone = isOverview
    ? healthStatus.color
    : isInvest
    ? COLORS.invest
    : (rowsTone === "income" ? COLORS.income : COLORS.expense);

  /* -------------------------- form handlers -------------------------- */

  function openAddModal(type, existing) {
    setAddModalType(type);
    setFormError("");
    const defaultCategory = type === "investimento" ? "renda_fixa" : type === "receita" ? "fixa" : type === "fixa" ? "moradia" : "mercado";
    if (existing) {
      // Para despesa fixa, a linha exibida traz o parcelamento já projetado pro mês
      // selecionado; buscamos a definição crua pra não regravar o parcelamento errado.
      const rawExisting = type === "fixa" ? (fixedExpenses.find((f) => f.id === existing.id) || existing) : existing;
      setEditingId(rawExisting.id);
      setFormName(rawExisting.name);
      setFormAmountCents(rawExisting.amountCents);
      setFormCategory(rawExisting.category || defaultCategory);
      if (type === "fixa") {
        setFormRecurrenceType(rawExisting.installment ? "parcelado" : rawExisting.subscription ? "assinatura" : "fixo");
        setFormInstallmentCurrent(rawExisting.installment ? String(rawExisting.installment.current) : "1");
        setFormInstallmentTotal(rawExisting.installment ? String(rawExisting.installment.total) : "2");
        setFormDueDay(rawExisting.dueDay ? String(rawExisting.dueDay) : "");
        setFormPaymentDate(existing.paymentDate || "");
        setFormPaidStatus(existing.paid ? "pago" : "aberto");
      } else if (type === "variavel") {
        setFormPaymentDate(existing.paymentDate || "");
        setFormPaidStatus(existing.paid ? "pago" : "aberto");
      } else if (type === "receita") {
        setFormPaymentDate(existing.receiptDate || "");
      }
    } else {
      setEditingId(null);
      setFormName("");
      setFormAmountCents(0);
      setFormCategory(defaultCategory);
      setFormPaymentDate("");
      setFormPaidStatus("aberto");
      if (type === "fixa") {
        setFormRecurrenceType("fixo");
        setFormInstallmentCurrent("1");
        setFormInstallmentTotal("2");
        setFormDueDay(String(new Date().getDate()));
      }
    }
    setAddModalOpen(true);
  }

  function closeAddModal() { setAddModalOpen(false); }

  function applyLocalInsert(kind, saved) {
    if (kind === "receita") setIncome((prev) => [...prev, saved]);
    else if (kind === "fixa") setFixedExpenses((prev) => [...prev, saved]);
    else if (kind === "investimento") setInvestAllocations((prev) => [...prev, saved]);
    else setVariableExpenses((prev) => [...prev, saved]);
  }

  function applyLocalUpdate(kind, saved) {
    const updater = (prev) => prev.map((i) => (i.id === saved.id ? saved : i));
    if (kind === "receita") setIncome(updater);
    else if (kind === "fixa") setFixedExpenses(updater);
    else if (kind === "investimento") setInvestAllocations(updater);
    else setVariableExpenses(updater);
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError("Digite uma descrição.");
      return;
    }
    if (!formAmountCents || formAmountCents <= 0) {
      setFormError("Digite um valor maior que zero.");
      return;
    }
    setFormError("");
    const existingEntry = editingId
      ? (income.find((i) => i.id === editingId) || fixedExpenses.find((i) => i.id === editingId) || variableExpenses.find((i) => i.id === editingId) || investAllocations.find((i) => i.id === editingId) || {})
      : {};
    const showsDatePicker = addModalType === "receita" || addModalType === "fixa" || addModalType === "variavel";
    const pickedDate = showsDatePicker && formPaymentDate ? formatDateShort(formPaymentDate) : null;
    const entry = { name: formName.trim(), amountCents: formAmountCents, date: pickedDate || existingEntry.date || todayShort() };
    let payload;
    if (addModalType === "receita") {
      payload = {
        ...entry,
        category: formCategory,
        receiptDate: formPaymentDate || null,
        received: editingId ? existingEntry.received || false : false,
        referenceMonth: editingId ? existingEntry.referenceMonth || currentMonthKey : currentMonthKey,
      };
    } else if (addModalType === "fixa") {
      const installment = formRecurrenceType === "parcelado"
        ? { current: Math.max(1, parseInt(formInstallmentCurrent, 10) || 1), total: Math.max(1, parseInt(formInstallmentTotal, 10) || 1) }
        : null;
      const subscription = formRecurrenceType === "assinatura";
      const dueDay = formDueDay ? Math.min(31, Math.max(1, parseInt(formDueDay, 10) || 0)) || null : null;
      const startMonth = editingId ? existingEntry.startMonth || currentMonthKey : currentMonthKey;
      const paid = formPaidStatus === "pago";
      const existingPaidMonths = existingEntry.paidMonths || {};
      const paidMonths = {
        ...existingPaidMonths,
        [currentMonthKey]: paid
          ? { paid: true, paymentDate: formPaymentDate || existingPaidMonths[currentMonthKey]?.paymentDate || todayISO() }
          : { paid: false, paymentDate: existingPaidMonths[currentMonthKey]?.paymentDate || null },
      };
      payload = {
        ...entry,
        category: formCategory,
        installment,
        subscription,
        dueDay,
        startMonth,
        paidMonths,
      };
    } else if (addModalType === "investimento") {
      payload = { ...entry, category: formCategory };
    } else {
      const paid = formPaidStatus === "pago";
      payload = {
        ...entry,
        category: formCategory,
        paymentDate: formPaymentDate || (paid ? todayISO() : null),
        paid,
        deferred: editingId ? existingEntry.deferred || false : false,
        referenceMonth: editingId ? existingEntry.referenceMonth || currentMonthKey : currentMonthKey,
      };
    }

    setSaving(true);
    try {
      if (editingId) {
        const saved = await updateEntry(addModalType, editingId, payload);
        applyLocalUpdate(addModalType, saved);
      } else {
        const saved = await insertEntry(addModalType, payload, user.id);
        applyLocalInsert(addModalType, saved);
      }
      setAddModalOpen(false);
    } catch (e) {
      setFormError(describeSupabaseError(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    try {
      await deleteEntry(addModalType, editingId);
      const remover = (prev) => prev.filter((i) => i.id !== editingId);
      if (addModalType === "receita") setIncome(remover);
      else if (addModalType === "fixa") setFixedExpenses(remover);
      else if (addModalType === "investimento") setInvestAllocations(remover);
      else setVariableExpenses(remover);
      setAddModalOpen(false);
    } catch (e) {
      setFormError(describeSupabaseError(e));
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(kind, id) {
    if (kind === "fixa") {
      const def = fixedExpenses.find((f) => f.id === id);
      if (!def) return;
      const currentStatus = def.paidMonths?.[currentMonthKey] || {};
      const nextPaid = !currentStatus.paid;
      const nextPaidMonths = {
        ...def.paidMonths,
        [currentMonthKey]: { paid: nextPaid, paymentDate: nextPaid ? todayISO() : currentStatus.paymentDate || null },
      };
      try {
        const saved = await patchEntry("fixa", id, { paid_months: nextPaidMonths });
        setFixedExpenses((prev) => prev.map((i) => (i.id === id ? saved : i)));
      } catch (e) {
        console.error("Falha ao atualizar pagamento:", e);
      }
      return;
    }
    const current = variableExpenses.find((i) => i.id === id);
    if (!current) return;
    const nextPaid = !current.paid;
    const nextPaymentDate = nextPaid ? todayISO() : current.paymentDate;
    try {
      const saved = await patchEntry("variavel", id, { paid: nextPaid, payment_date: nextPaymentDate });
      setVariableExpenses((prev) => prev.map((i) => (i.id === id ? saved : i)));
    } catch (e) {
      console.error("Falha ao atualizar pagamento:", e);
    }
  }

  async function toggleReceived(id) {
    const current = income.find((i) => i.id === id);
    if (!current) return;
    const nextReceived = !current.received;
    const nextReceiptDate = nextReceived ? todayISO() : current.receiptDate;
    try {
      const saved = await patchEntry("receita", id, { received: nextReceived, receipt_date: nextReceiptDate });
      setIncome((prev) => prev.map((i) => (i.id === id ? saved : i)));
    } catch (e) {
      console.error("Falha ao atualizar recebimento:", e);
    }
  }

  async function deferToNextMonth(kind, entryRow) {
    if (kind !== "variavel") return;
    try {
      const updatedCurrent = await patchEntry("variavel", entryRow.id, { deferred: true });
      const nextMonthKey = monthKeyFromOffset(monthOffset + 1);
      const duplicatePayload = {
        ...entryRow,
        deferred: false,
        paid: false,
        paymentDate: null,
        referenceMonth: nextMonthKey,
      };
      delete duplicatePayload.id;
      const inserted = await insertEntry("variavel", duplicatePayload, user.id);
      setVariableExpenses((prev) => [...prev.map((i) => (i.id === entryRow.id ? updatedCurrent : i)), inserted]);
    } catch (e) {
      console.error("Falha ao adiar lançamento:", e);
    }
  }

  function openCategoryModal(target, existing) {
    setCategoryModalTarget(target);
    setCategoryEditingId(existing ? existing.id : null);
    setNewCategoryName(existing ? existing.label : "");
    setNewCategoryColor(existing ? existing.color : "#6C5CE0");
    setCategoryModalOpen(true);
  }

  async function saveCategory() {
    const label = newCategoryName.trim();
    if (!label) return;
    try {
      if (categoryEditingId) {
        await updateCategory(categoryModalTarget, categoryEditingId, { label, color: newCategoryColor }, user.id);
        const updater = (prev) => prev.map((c) => (c.id === categoryEditingId ? { ...c, label, color: newCategoryColor } : c));
        if (categoryModalTarget === "fixa") setFixedCategories(updater);
        else setVariableCategories(updater);
      } else {
        const newCat = { id: `custom_${uid()}`, label, color: newCategoryColor };
        await insertCategory(categoryModalTarget, newCat, user.id);
        if (categoryModalTarget === "fixa") {
          setFixedCategories((prev) => [...prev, newCat]);
        } else {
          setVariableCategories((prev) => [...prev, newCat]);
        }
        setFormCategory(newCat.id);
      }
      setCategoryModalOpen(false);
    } catch (e) {
      console.error("Falha ao salvar categoria:", e);
    }
  }

  async function deleteCategoryHandler() {
    if (!categoryEditingId) return;
    try {
      await deleteCategory(categoryModalTarget, categoryEditingId, user.id);
      const remover = (prev) => prev.filter((c) => c.id !== categoryEditingId);
      if (categoryModalTarget === "fixa") setFixedCategories(remover);
      else setVariableCategories(remover);
      if (formCategory === categoryEditingId) {
        setFormCategory(categoryModalTarget === "fixa" ? "moradia" : "mercado");
      }
      setCategoryModalOpen(false);
    } catch (e) {
      console.error("Falha ao excluir categoria:", e);
    }
  }

  function openInvestModal() {
    setTempInvestPercent(investPercent);
    setTempInvestAmountCents(Math.round((totalIncome * investPercent) / 100));
    setInvestAmountEditing(false);
    setInvestModalOpen(true);
  }
  function saveInvest() { setInvestPercent(tempInvestPercent); setInvestModalOpen(false); }

  function setInvestPercentFromSlider(p) {
    setTempInvestPercent(p);
    setTempInvestAmountCents(Math.round((totalIncome * p) / 100));
  }

  function setInvestAmountFromInput(cents) {
    setTempInvestAmountCents(cents);
    const pct = totalIncome > 0 ? Math.round((cents / totalIncome) * 100) : 0;
    setTempInvestPercent(Math.min(100, Math.max(0, pct)));
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Preencha e-mail e senha para continuar.");
      return;
    }
    setLoginError("");
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setAuthBusy(false);
    if (error) {
      setLoginError(describeSupabaseError(error));
      return;
    }
    setSection("overview");
  }

  async function handleSignup() {
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setSignupError("Preencha todos os campos.");
      return;
    }
    if (signupPassword.length < 6) {
      setSignupError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupError("As senhas não coincidem.");
      return;
    }
    setSignupError("");
    setAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: { data: { name: signupName.trim() } },
    });
    setAuthBusy(false);
    if (error) {
      setSignupError(describeSupabaseError(error));
      return;
    }
    if (!data.session) {
      setSignupConfirmationSent(true);
      return;
    }
    setSection("overview");
  }

  function switchAuthView(view) {
    setAuthView(view);
    setLoginError("");
    setSignupError("");
    setSignupConfirmationSent(false);
    setForgotError("");
    setForgotSubmitted(false);
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) {
      setForgotError("Digite seu e-mail.");
      return;
    }
    if (!forgotEmail.includes("@") || !forgotEmail.includes(".")) {
      setForgotError("Digite um e-mail válido.");
      return;
    }
    setForgotError("");
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
    setAuthBusy(false);
    if (error) {
      setForgotError(describeSupabaseError(error));
      return;
    }
    setForgotSubmitted(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setLoginPassword("");
    setLoginError("");
    setAuthView("login");
  }

  function isRowDone(kind, r) {
    if (kind === "receita") return !!r.received;
    if (kind === "fixa" || kind === "variavel") return !!r.paid;
    return true;
  }

  function incomeReceiptStatus(entry) {
    if (!entry.receiptDate) return null;
    if (entry.received) return "confirmed";
    const today = todayISO();
    if (entry.receiptDate < today) return "overdue";
    return "pending";
  }

  const trackedIncome = useMemo(
    () => [...monthIncome].filter((e) => e.receiptDate).sort((a, b) => a.receiptDate.localeCompare(b.receiptDate)),
    [monthIncome]
  );

  async function confirmReceived(id) {
    try {
      const saved = await patchEntry("receita", id, { received: true });
      setIncome((prev) => prev.map((i) => (i.id === id ? saved : i)));
    } catch (e) {
      console.error("Falha ao confirmar recebimento:", e);
    }
  }

  const openTableRows = isOverview
    ? tableRows.filter((r) => r.kind !== "receita" && !isRowDone(r.kind, r))
    : [];
  const paidTableRows = isOverview
    ? tableRows.filter((r) => r.kind !== "receita" && isRowDone(r.kind, r))
    : [];

  function renderTableRows(rowsList, showActions) {
    return rowsList.map((r) => {
      const kind = isOverview ? r.kind : isInvest ? "investimento" : budgetTab;
      const catSource =
        kind === "receita" ? INCOME_CATEGORY_PALETTE :
        kind === "investimento" ? INVEST_CATEGORY_PALETTE :
        kind === "variavel" ? variableCategories :
        kind === "fixa" ? fixedCategories : null;
      const cat = catSource && r.category && catSource.find((c) => c.id === r.category);
      const badgeLabel = cat ? cat.label : "Outros";
      const badgeColor = cat ? cat.color : COLORS.invest;
      const amountColor = kind === "receita" ? COLORS.income : kind === "investimento" ? COLORS.invest : COLORS.expense;
      const amountSign = kind === "receita" || kind === "investimento" ? "" : "- ";
      const installmentDone = r.installment && r.installment.current >= r.installment.total;
      const canTrackPayment = kind === "fixa" || kind === "variavel";
      return (
        <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.cardBorder}`, opacity: r.deferred ? 0.55 : 1 }}>
          <td className="px-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: `${badgeColor}1F`, color: badgeColor }}>
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium truncate block" style={{ color: COLORS.ink900 }}>{r.name}</span>
                {r.deferred && (
                  <span className="text-[10px] font-medium" style={{ color: COLORS.ink400 }}>
                    Adiada p/ mês seguinte
                  </span>
                )}
                {r.installment && (
                  <span className="text-[10px] font-medium" style={{ color: installmentDone ? COLORS.income : COLORS.ink400 }}>
                    Parcela {r.installment.current}/{r.installment.total}{installmentDone ? " · concluída" : ""}
                  </span>
                )}
                {r.subscription && (
                  <span className="text-[10px] font-medium" style={{ color: COLORS.primary }}>
                    Assinatura · recorrente
                  </span>
                )}
                {r.dueDay && !r.paid && !r.deferred && (
                  <span className="text-[10px] font-medium block" style={{ color: daysUntilDue(r.dueDay) <= 3 ? COLORS.expense : daysUntilDue(r.dueDay) <= 7 ? COLORS.invest : COLORS.ink400 }}>
                    {dueLabel(daysUntilDue(r.dueDay))}
                  </span>
                )}
                {canTrackPayment && r.paid && (
                  <span className="text-[10px] font-medium block" style={{ color: COLORS.income }}>
                    Paga{r.paymentDate ? ` em ${formatDateShort(r.paymentDate)}` : ""}
                  </span>
                )}
                {kind === "receita" && (
                  <span className="text-[10px] font-medium block" style={{ color: r.received ? COLORS.income : COLORS.ink400 }}>
                    {r.received ? `Recebida${r.receiptDate ? ` em ${formatDateShort(r.receiptDate)}` : ""}` : "Aguardando recebimento"}
                  </span>
                )}
              </div>
            </div>
          </td>
          <td className="px-3 py-3">
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${badgeColor}1A`, color: badgeColor }}>
              {badgeLabel}
            </span>
          </td>
          <td className="px-3 py-3 text-xs" style={{ color: COLORS.ink600 }}>{r.date || "—"}</td>
          <td className="px-3 py-3 text-xs font-semibold tabular-nums" style={{ color: amountColor }}>
            {hideAmounts ? "••••" : `${amountSign}${brl(r.amountCents)}`}
          </td>
          <td className="px-3 py-3">
            <div className="flex items-center justify-end gap-1.5">
              {showActions && canTrackPayment && !r.deferred && (
                <button
                  onClick={() => togglePaid(kind, r.id)}
                  aria-label={r.paid ? "Marcar como não paga" : "Marcar como paga"}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-full whitespace-nowrap"
                  style={r.paid ? { background: COLORS.incomeSoft, color: COLORS.income } : { background: COLORS.page, color: COLORS.ink600 }}
                >
                  <Check size={12} />
                  Pago
                </button>
              )}
              {kind === "receita" && (
                <button
                  onClick={() => toggleReceived(r.id)}
                  aria-label={r.received ? "Marcar como não recebida" : "Marcar como recebida"}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-full whitespace-nowrap"
                  style={r.received ? { background: COLORS.incomeSoft, color: COLORS.income } : { background: COLORS.page, color: COLORS.ink600 }}
                >
                  <Check size={12} />
                  Recebido
                </button>
              )}
              {showActions && kind === "variavel" && !r.deferred && !r.paid && (
                <button
                  onClick={() => deferToNextMonth(kind, r)}
                  aria-label="Lançar para o mês seguinte"
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-full whitespace-nowrap"
                  style={{ background: COLORS.page, color: COLORS.ink600 }}
                >
                  <SkipForward size={12} />
                  Mês que vem
                </button>
              )}
              {!showActions && (
                <button
                  onClick={() => openAddModal(kind, r)}
                  aria-label="Editar"
                  className="p-1.5 rounded-full"
                  style={{ background: COLORS.page }}
                >
                  <Pencil size={12} style={{ color: COLORS.ink400 }} />
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    });
  }

  /* ---------------------------------------------------------------------- */

  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.navy1}, ${COLORS.navy2})`, fontFamily: "'Inter', sans-serif" }}>
        <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Carregando...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden p-4" style={{ background: `linear-gradient(135deg, ${COLORS.navy1}, ${COLORS.navy2})`, fontFamily: "'Inter', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          * { box-sizing: border-box; }
          .dots-pattern {
            background-image: radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1.5px);
            background-size: 13px 13px;
            -webkit-mask-image: radial-gradient(circle at 88% 30%, black 0%, black 15%, transparent 60%);
            mask-image: radial-gradient(circle at 88% 30%, black 0%, black 15%, transparent 60%);
          }
        `}</style>
        <div className="absolute inset-0 dots-pattern pointer-events-none" />

        <div className="relative w-full max-w-sm rounded-3xl p-8" style={{ background: COLORS.card, boxShadow: "0 24px 60px rgba(20,22,43,0.35)" }}>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: COLORS.primary }}>
              <Diamond size={18} color="#fff" />
            </div>
            <span className="font-bold text-lg" style={{ color: COLORS.ink900 }}>M.A.I.A</span>
          </div>

          {authView === "login" && (
            <>
              <h1 className="text-xl font-bold mb-1" style={{ color: COLORS.ink900 }}>Bem-vindo de volta</h1>
              <p className="text-xs mb-6" style={{ color: COLORS.ink600 }}>Entre para ver o resumo das suas finanças.</p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>E-mail</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
                    <Mail size={15} color={COLORS.ink400} />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="voce@email.com"
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: COLORS.ink900 }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Senha</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
                    <Lock size={15} color={COLORS.ink400} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: COLORS.ink900 }}
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                      {showPassword ? <EyeOff size={15} color={COLORS.ink400} /> : <Eye size={15} color={COLORS.ink400} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-xs font-medium" style={{ color: COLORS.expense }}>{loginError}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.ink600 }}>
                    <input type="checkbox" className="rounded" />
                    Lembrar de mim
                  </label>
                  <button type="button" onClick={() => switchAuthView("forgot")} className="text-xs font-medium" style={{ color: COLORS.primary }}>
                    Esqueci a senha
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={authBusy}
                  className="w-full text-sm font-semibold py-3 rounded-xl mt-2 disabled:opacity-60"
                  style={{ background: COLORS.primary, color: "#fff" }}
                >
                  {authBusy ? "Entrando..." : "Entrar"}
                </button>
              </div>

              <p className="text-xs text-center mt-6" style={{ color: COLORS.ink400 }}>
                Não tem conta?{" "}
                <button type="button" onClick={() => switchAuthView("signup")} className="font-semibold" style={{ color: COLORS.primary }}>
                  Criar conta
                </button>
              </p>
            </>
          )}

          {authView === "signup" && (
            <>
            {signupConfirmationSent ? (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.incomeSoft }}>
                  <Mail size={22} color={COLORS.income} />
                </div>
                <h1 className="text-xl font-bold mb-1" style={{ color: COLORS.ink900 }}>Confirme seu e-mail</h1>
                <p className="text-xs mb-6" style={{ color: COLORS.ink600 }}>
                  Enviamos um link de confirmação para <span className="font-semibold" style={{ color: COLORS.ink900 }}>{signupEmail}</span>. Confirme para poder entrar.
                </p>
                <button
                  type="button"
                  onClick={() => switchAuthView("login")}
                  className="w-full text-sm font-semibold py-3 rounded-xl"
                  style={{ background: COLORS.primary, color: "#fff" }}
                >
                  Voltar para o login
                </button>
              </>
            ) : (
            <>
              <h1 className="text-xl font-bold mb-1" style={{ color: COLORS.ink900 }}>Criar conta</h1>
              <p className="text-xs mb-6" style={{ color: COLORS.ink600 }}>Leva menos de um minuto.</p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Nome</label>
                  <TextInput value={signupName} onChange={setSignupName} placeholder="Seu nome" />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>E-mail</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
                    <Mail size={15} color={COLORS.ink400} />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="voce@email.com"
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: COLORS.ink900 }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Senha</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
                    <Lock size={15} color={COLORS.ink400} />
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: COLORS.ink900 }}
                    />
                    <button type="button" onClick={() => setShowSignupPassword((v) => !v)} aria-label={showSignupPassword ? "Ocultar senha" : "Mostrar senha"}>
                      {showSignupPassword ? <EyeOff size={15} color={COLORS.ink400} /> : <Eye size={15} color={COLORS.ink400} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Confirmar senha</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
                    <Lock size={15} color={COLORS.ink400} />
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSignup(); }}
                      placeholder="Repita a senha"
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: COLORS.ink900 }}
                    />
                  </div>
                </div>

                {signupError && (
                  <p className="text-xs font-medium" style={{ color: COLORS.expense }}>{signupError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={authBusy}
                  className="w-full text-sm font-semibold py-3 rounded-xl mt-2 disabled:opacity-60"
                  style={{ background: COLORS.primary, color: "#fff" }}
                >
                  {authBusy ? "Criando..." : "Criar conta"}
                </button>
              </div>

              <p className="text-xs text-center mt-6" style={{ color: COLORS.ink400 }}>
                Já tem conta?{" "}
                <button type="button" onClick={() => switchAuthView("login")} className="font-semibold" style={{ color: COLORS.primary }}>
                  Entrar
                </button>
              </p>
            </>
            )}
            </>
          )}

          {authView === "forgot" && (
            <>
              {!forgotSubmitted ? (
                <>
                  <h1 className="text-xl font-bold mb-1" style={{ color: COLORS.ink900 }}>Esqueci a senha</h1>
                  <p className="text-xs mb-6" style={{ color: COLORS.ink600 }}>
                    Digite o e-mail da sua conta e enviaremos um link pra redefinir sua senha.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>E-mail</label>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}` }}>
                        <Mail size={15} color={COLORS.ink400} />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleForgotPassword(); }}
                          placeholder="voce@email.com"
                          className="w-full bg-transparent outline-none text-sm"
                          style={{ color: COLORS.ink900 }}
                        />
                      </div>
                    </div>

                    {forgotError && (
                      <p className="text-xs font-medium" style={{ color: COLORS.expense }}>{forgotError}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={authBusy}
                      className="w-full text-sm font-semibold py-3 rounded-xl mt-2 disabled:opacity-60"
                      style={{ background: COLORS.primary, color: "#fff" }}
                    >
                      {authBusy ? "Enviando..." : "Enviar link de recuperação"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.incomeSoft }}>
                    <Mail size={22} color={COLORS.income} />
                  </div>
                  <h1 className="text-xl font-bold mb-1" style={{ color: COLORS.ink900 }}>Verifique seu e-mail</h1>
                  <p className="text-xs mb-6" style={{ color: COLORS.ink600 }}>
                    Se houver uma conta com o e-mail <span className="font-semibold" style={{ color: COLORS.ink900 }}>{forgotEmail}</span>, enviamos um link de recuperação pra ela.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchAuthView("login")}
                    className="w-full text-sm font-semibold py-3 rounded-xl"
                    style={{ background: COLORS.primary, color: "#fff" }}
                  >
                    Voltar para o login
                  </button>
                </>
              )}

              <p className="text-xs text-center mt-6" style={{ color: COLORS.ink400 }}>
                Lembrou a senha?{" "}
                <button type="button" onClick={() => switchAuthView("login")} className="font-semibold" style={{ color: COLORS.primary }}>
                  Entrar
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.page, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .dots-pattern {
          background-image: radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1.5px);
          background-size: 13px 13px;
          -webkit-mask-image: radial-gradient(circle at 88% 30%, black 0%, black 15%, transparent 60%);
          mask-image: radial-gradient(circle at 88% 30%, black 0%, black 15%, transparent 60%);
        }
      `}</style>

      <div className="max-w-6xl mx-auto p-3 sm:p-5 lg:p-6">
        {/* ---------------- header ---------------- */}
        <div className="relative overflow-hidden rounded-3xl mb-5" style={{ background: `linear-gradient(135deg, ${COLORS.navy1}, ${healthStatus.dark})`, transition: "background 0.4s ease" }}>
          <div className="h-1" style={{ background: healthStatus.color, transition: "background 0.4s ease" }} />
          <div className="absolute inset-0 dots-pattern pointer-events-none" />
          <div className="relative px-5 sm:px-8 pt-5 pb-6">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: COLORS.primary }}>
                  <Diamond size={14} color="#fff" />
                </div>
                <span className="font-bold text-white text-sm">M.A.I.A</span>
              </div>

              <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                {[{ id: "overview", label: "Visão geral" }, { id: "budget", label: "Orçamento" }, { id: "invest", label: "Investimentos" }].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                    style={section === s.id ? { background: "#fff", color: COLORS.ink900 } : { color: "rgba(255,255,255,0.6)" }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <Search size={13} color="rgba(255,255,255,0.5)" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar lançamento"
                    className="bg-transparent outline-none text-xs w-32"
                    style={{ color: "#fff" }}
                  />
                </div>
                <button onClick={() => setHideAmounts((v) => !v)} aria-label="Ocultar valores">
                  {hideAmounts ? <EyeOff size={16} color="rgba(255,255,255,0.7)" /> : <Eye size={16} color="rgba(255,255,255,0.7)" />}
                </button>
                <Bell size={16} color="rgba(255,255,255,0.7)" />
                <button onClick={handleLogout} aria-label="Sair">
                  <LogOut size={16} color="rgba(255,255,255,0.7)" />
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-white text-xl sm:text-2xl font-bold mb-1">Olá, {userName || "você"}!</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Resumo financeiro do mês</p>
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${healthStatus.color}26`, color: healthStatus.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: healthStatus.color }} />
                    {healthStatus.label}
                  </span>
                  {dataLoading && (
                    <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Sincronizando...</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <button onClick={() => setMonthOffset((m) => m - 1)} aria-label="Mês anterior">
                  <ChevronLeft size={14} color="rgba(255,255,255,0.7)" />
                </button>
                <span className="text-[11px] font-medium px-1 text-white">{currentMonthLabel}</span>
                <button onClick={() => setMonthOffset((m) => m + 1)} aria-label="Próximo mês">
                  <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                </button>
              </div>
            </div>

            {isBudget && (
              <div className="flex gap-5 mt-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {["receita", "fixa", "variavel"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setBudgetTab(t)}
                    className="text-xs font-medium pb-3"
                    style={
                      budgetTab === t
                        ? { color: "#fff", borderBottom: `2px solid ${COLORS.primary}` }
                        : { color: "rgba(255,255,255,0.45)", borderBottom: "2px solid transparent" }
                    }
                  >
                    {tabLabel[t]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- body ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
          {/* left column */}
          <div className="space-y-5">
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>{balanceLabel}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: COLORS.primarySoft, color: COLORS.primary }}>
                  {currentMonthLabel.split(" ")[0]}
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums mb-4" style={{ color: balanceTone }}>
                {hideAmounts ? "R$ ••••" : brl(balanceValue)}
              </div>
              {isBudget && (
                <button
                  onClick={() => openAddModal(budgetTab, null)}
                  className="w-full text-xs font-semibold py-2.5 rounded-xl"
                  style={{ background: COLORS.primary, color: "#fff" }}
                >
                  Adicionar
                </button>
              )}
              {isInvest && (
                <div className="flex gap-2">
                  <button
                    onClick={openInvestModal}
                    className="flex-1 text-xs font-semibold py-2.5 rounded-xl"
                    style={{ background: COLORS.invest, color: "#fff" }}
                  >
                    Ajustar %
                  </button>
                  <button
                    onClick={() => openAddModal("investimento", null)}
                    className="flex-1 text-xs font-semibold py-2.5 rounded-xl"
                    style={{ background: COLORS.page, color: COLORS.ink900, border: `1px solid ${COLORS.cardBorder}` }}
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </div>

            {!isReceitaTab && !isFixaTab && !isVariavelTab && (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <span className="text-xs font-medium block mb-4" style={{ color: COLORS.ink600 }}>
                {isInvest ? "Alocação por tipo" : "Maiores gastos"}
              </span>
              {(isInvest ? investBreakdown : isFixaTab ? fixedBreakdown : categoryBreakdown).length === 0 ? (
                <p className="text-xs" style={{ color: COLORS.ink400 }}>
                  {isInvest ? "Nenhum investimento cadastrado ainda." : isFixaTab ? "Nenhuma despesa fixa ainda." : "Nenhuma despesa variável ainda."}
                </p>
              ) : (
                <div className="space-y-4">
                  {(isInvest ? investBreakdown : isFixaTab ? fixedBreakdown : categoryBreakdown).slice(0, 4).map((c) => (
                    <div key={c.id}>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: `${c.color}1F`, color: c.color }}>
                          {c.label.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate" style={{ color: COLORS.ink900 }}>{c.label}</div>
                          <div className="text-[10px]" style={{ color: COLORS.ink400 }}>{isInvest ? "Alocado" : "Gasto no mês"}</div>
                        </div>
                        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: COLORS.ink900 }}>
                          {hideAmounts ? "••••" : brl(c.value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden ml-[42px]" style={{ background: COLORS.page }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round((c.value / ((isInvest ? investBreakdown : isFixaTab ? fixedBreakdown : categoryBreakdown)[0]?.value || 1)) * 100)}%`, background: c.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Orçamento por categoria — só na aba Despesa variável */}
            {isVariavelTab && (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <span className="text-xs font-medium block mb-1" style={{ color: COLORS.ink600 }}>Orçamento por categoria</span>
              <p className="text-[11px] mb-4" style={{ color: COLORS.ink400 }}>Defina um teto mensal pra cada categoria.</p>
              <div className="space-y-4">
                {variableCategories.map((c) => {
                  const spent = categoryBreakdown.find((b) => b.id === c.id)?.value || 0;
                  const budget = categoryBudgets[c.id] || 0;
                  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
                  const over = budget > 0 && spent > budget;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: COLORS.ink900 }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                          {c.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <span style={{ color: COLORS.ink400, fontSize: 11 }}>R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={budget ? (budget / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
                            placeholder="sem teto"
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              setCategoryBudgets((prev) => ({ ...prev, [c.id]: digits === "" ? 0 : parseInt(digits, 10) }));
                            }}
                            className="w-20 text-right text-xs rounded-lg px-1.5 py-1 outline-none"
                            style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                          />
                        </div>
                      </div>
                      {budget > 0 && (
                        <>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.page }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: over ? COLORS.expense : c.color }} />
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: over ? COLORS.expense : COLORS.ink400 }}>
                            {hideAmounts ? "••••" : brl(spent)} de {hideAmounts ? "••••" : brl(budget)} {over ? "· estourou" : `· ${pct}%`}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Comparativo com o mês anterior — só na Visão geral */}
            {isOverview && (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>Comparado ao mês anterior</span>
                <RefreshCw size={13} color={COLORS.ink400} />
              </div>
              {!monthComparison ? (
                <>
                  <p className="text-[11px] mb-3" style={{ color: COLORS.ink400 }}>
                    Salve os números deste mês como referência pra comparar com o próximo.
                  </p>
                  <button
                    onClick={saveMonthSnapshot}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl"
                    style={{ background: COLORS.page, color: COLORS.ink900, border: `1px solid ${COLORS.cardBorder}` }}
                  >
                    <Save size={13} /> Salvar este mês como referência
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] mb-3" style={{ color: COLORS.ink400 }}>Referência: {previousMonthSnapshot.label}</p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Receita", delta: monthComparison.incomeDelta, goodUp: true },
                      { label: "Despesas", delta: monthComparison.expenseDelta, goodUp: false },
                      { label: "Saldo", delta: monthComparison.saldoDelta, goodUp: true },
                    ].map((row) => {
                      const noData = row.delta === null;
                      const isGood = !noData && (row.goodUp ? row.delta >= 0 : row.delta <= 0);
                      const color = noData ? COLORS.ink400 : isGood ? COLORS.income : COLORS.expense;
                      return (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: COLORS.ink900 }}>{row.label}</span>
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color }}>
                            {!noData && (row.delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}
                            {noData ? "sem base" : `${row.delta > 0 ? "+" : ""}${row.delta}%`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={saveMonthSnapshot}
                    className="w-full text-[11px] font-medium py-2 rounded-lg mt-3"
                    style={{ color: COLORS.primary }}
                  >
                    Atualizar referência para este mês
                  </button>
                </>
              )}
            </div>
            )}

            {/* Vencimentos + assinaturas — só na aba Despesa fixa */}
            {isFixaTab && (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>Vencimentos</span>
                <Calendar size={14} color={COLORS.ink400} />
              </div>
              {activeSubscriptionsCount > 0 && (
                <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg" style={{ background: COLORS.investSoft }}>
                  <RefreshCw size={12} color={COLORS.invest} />
                  <span className="text-[11px] font-medium" style={{ color: COLORS.invest }}>
                    {activeSubscriptionsCount} assinatura{activeSubscriptionsCount > 1 ? "s" : ""} · {hideAmounts ? "••••" : brl(subscriptionsAnnualCents)}/ano
                  </span>
                </div>
              )}
              {upcomingDue.length === 0 ? (
                <p className="text-xs" style={{ color: COLORS.ink400 }}>Nenhuma despesa fixa com dia de vencimento definido.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingDue.map((e) => {
                    const urgent = e.daysLeft <= 3;
                    const soon = e.daysLeft <= 7;
                    const color = urgent ? COLORS.expense : soon ? COLORS.invest : COLORS.ink400;
                    return (
                      <div key={e.id} className="flex items-center justify-between">
                        <span className="text-xs truncate" style={{ color: COLORS.ink900 }}>{e.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: urgent ? COLORS.expenseSoft : soon ? COLORS.investSoft : COLORS.page, color }}>
                          {dueLabel(e.daysLeft)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </div>

          {/* right column */}
          <div className="space-y-5">
            {!isInvest && !isReceitaTab && !isFixaTab && !isVariavelTab && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={<TrendingUp />}
                iconBg={COLORS.incomeSoft}
                iconColor={COLORS.income}
                label="Receita total"
                value={brl(totalIncome)}
                hide={hideAmounts}
              />
              <div className="rounded-2xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>Limite de gastos</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: healthStatus.soft, color: healthStatus.color }}>
                      {healthStatus.label}
                    </span>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: healthStatus.soft }}>
                      <Target size={15} color={healthStatus.color} />
                    </div>
                  </div>
                </div>
                <div className="text-xs mb-2" style={{ color: COLORS.ink900 }}>
                  <span className="font-bold">{hideAmounts ? "R$ ••••" : brl(totalExpenses)}</span>
                  <span style={{ color: COLORS.ink400 }}> usado de {hideAmounts ? "R$ ••••" : brl(totalIncome)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.page }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, expensePercentOfIncome)}%`, background: healthStatus.color }}
                  />
                </div>
              </div>
              <StatCard
                icon={<TrendingDown />}
                iconBg={COLORS.expenseSoft}
                iconColor={COLORS.expense}
                label="Despesa total"
                value={brl(totalExpenses)}
                hide={hideAmounts}
              />
            </div>
            )}

            {!isInvest && !isReceitaTab && !isFixaTab && !isVariavelTab && (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: COLORS.ink900 }}>Como sua receita foi consumida</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.primarySoft }}>
                  <PieIcon size={15} color={COLORS.primary} />
                </div>
              </div>
              <p className="text-xs mb-3" style={{ color: COLORS.ink400 }}>Despesas fixas, variáveis e investimento, em % da receita do mês.</p>
              {incomeUsageBreakdown.length === 0 || totalIncome === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: COLORS.ink400 }}>Lance uma receita para ver o gráfico.</p>
              ) : (
                <div className="sm:flex sm:items-center sm:gap-6">
                  <div style={{ height: 200 }} className="sm:w-[200px] sm:shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={incomeUsageBreakdown} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2}>
                          {incomeUsageBreakdown.map((d, i) => (
                            <Cell key={i} fill={d.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => (hideAmounts ? "••••" : brl(v))} contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: COLORS.ink900 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-2 mt-3 sm:mt-0 flex-1">
                    {incomeUsageBreakdown.map((d) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-xs truncate flex-1" style={{ color: d.id === "livre" ? COLORS.income : COLORS.ink900 }}>{d.label}</span>
                        <span className="text-xs font-semibold shrink-0" style={{ color: COLORS.ink600 }}>
                          {Math.round((d.value / totalIncome) * 100)}%
                        </span>
                        <span className="text-xs font-semibold tabular-nums shrink-0 w-20 text-right" style={{ color: COLORS.ink900 }}>
                          {hideAmounts ? "••••" : brl(d.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {isInvest && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                icon={<TrendingUp />}
                iconBg={COLORS.investSoft}
                iconColor={COLORS.invest}
                label="Investido este mês"
                value={brl(investAmountCents)}
                hide={hideAmounts}
              />
              <div className="rounded-2xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>% da receita reservado</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.investSoft }}>
                    <Target size={15} color={COLORS.invest} />
                  </div>
                </div>
                <div className="text-xl font-bold tabular-nums mb-2" style={{ color: COLORS.ink900 }}>{investPercent}%</div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.page }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, investPercent)}%`, background: COLORS.invest }} />
                </div>
              </div>
              <StatCard
                icon={<TrendingDown />}
                iconBg={remainingToAllocate < 0 ? COLORS.expenseSoft : COLORS.primarySoft}
                iconColor={remainingToAllocate < 0 ? COLORS.expense : COLORS.primary}
                label={remainingToAllocate < 0 ? "Alocado a mais" : "Falta alocar"}
                value={brl(Math.abs(remainingToAllocate))}
                hide={hideAmounts}
              />
              <div className="rounded-2xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>Alocação por tipo</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.primarySoft }}>
                    <PieIcon size={15} color={COLORS.primary} />
                  </div>
                </div>
                {investBreakdown.length === 0 ? (
                  <p className="text-xs" style={{ color: COLORS.ink400 }}>Sem dados ainda.</p>
                ) : (
                  <>
                    <div className="flex h-1.5 rounded-full overflow-hidden mb-2.5" style={{ background: COLORS.page }}>
                      {investBreakdown.map((c) => (
                        <div key={c.id} style={{ width: `${Math.round((c.value / allocatedTotal) * 100)}%`, background: c.color }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {investBreakdown.slice(0, 3).map((c) => (
                        <span key={c.id} className="flex items-center gap-1 text-[10px]" style={{ color: COLORS.ink600 }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} /> {c.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            )}

            {isInvest && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>Reserva de emergência</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.incomeSoft }}>
                    <Shield size={15} color={COLORS.income} />
                  </div>
                </div>
                {totalFixed === 0 ? (
                  <p className="text-xs" style={{ color: COLORS.ink400 }}>Cadastre despesas fixas pra calcular a cobertura.</p>
                ) : (
                  <>
                    <div className="text-xl font-bold tabular-nums mb-1" style={{ color: COLORS.ink900 }}>
                      {emergencyMonthsCoverage.toFixed(1)} <span className="text-xs font-medium" style={{ color: COLORS.ink400 }}>meses de cobertura</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: COLORS.page }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (emergencyMonthsCoverage / emergencyGoalMonths) * 100)}%`, background: emergencyMonthsCoverage >= emergencyGoalMonths ? COLORS.income : COLORS.invest }} />
                    </div>
                    <div className="text-[10px]" style={{ color: COLORS.ink400 }}>
                      {hideAmounts ? "••••" : brl(emergencyReserveCents)} alocados · meta: {emergencyGoalMonths} meses de despesas fixas
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: COLORS.ink600 }}>Projeção de patrimônio</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.primarySoft }}>
                    <Sparkles size={15} color={COLORS.primary} />
                  </div>
                </div>
                {investAmountCents <= 0 ? (
                  <p className="text-xs" style={{ color: COLORS.ink400 }}>Ajuste o % de investimento pra ver a projeção.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="number"
                        min={1}
                        value={projectionMonths}
                        onChange={(e) => setProjectionMonths(e.target.value)}
                        className="w-16 text-xs rounded-lg px-2 py-1.5 outline-none"
                        style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                      />
                      <span className="text-[11px]" style={{ color: COLORS.ink400 }}>meses a</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={projectionRate}
                        onChange={(e) => setProjectionRate(e.target.value)}
                        className="w-14 text-xs rounded-lg px-2 py-1.5 outline-none"
                        style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                      />
                      <span className="text-[11px]" style={{ color: COLORS.ink400 }}>% a.m.</span>
                    </div>
                    <div className="text-xl font-bold tabular-nums" style={{ color: COLORS.primary }}>
                      {hideAmounts ? "R$ ••••" : brl(projectedFutureValueCents)}
                    </div>
                    <div className="text-[10px]" style={{ color: COLORS.ink400 }}>
                      {hideAmounts ? "••••" : brl(projectedContributedCents)} aportado + {hideAmounts ? "••••" : brl(Math.max(0, projectedGainCents))} de rendimento
                    </div>
                  </>
                )}
              </div>
            </div>
            )}

            {/* receita recebida */}
            {isOverview && trackedIncome.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ color: COLORS.ink900 }}>Receita recebida</span>
                <Calendar size={14} color={COLORS.ink400} />
              </div>
              <div className="space-y-3">
                {trackedIncome.map((e) => {
                  const status = incomeReceiptStatus(e);
                  const statusInfo = {
                    confirmed: { label: `Recebida${e.receiptDate ? ` em ${formatDateShort(e.receiptDate)}` : ""}`, color: COLORS.income, bg: COLORS.incomeSoft },
                    pending: { label: `A receber${e.receiptDate ? ` · ${formatDateShort(e.receiptDate)}` : ""}`, color: COLORS.invest, bg: COLORS.investSoft },
                    overdue: { label: "Receita em atraso", color: COLORS.expense, bg: COLORS.expenseSoft },
                  }[status];
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: COLORS.ink900 }}>{e.name}</div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold tabular-nums" style={{ color: COLORS.ink900 }}>
                          {hideAmounts ? "••••" : brl(e.amountCents)}
                        </span>
                        {status !== "confirmed" && (
                          <button
                            onClick={() => confirmReceived(e.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-full"
                            style={{ background: COLORS.income, color: "#fff" }}
                          >
                            <Check size={11} /> Confirmar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* table */}
            {isOverview ? (
              <>
                <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold" style={{ color: COLORS.ink900 }}>Lançamentos em aberto</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: COLORS.expenseSoft, color: COLORS.expense }}>
                      {openTableRows.length}
                    </span>
                  </div>
                  {openTableRows.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: COLORS.ink400 }}>Tudo pago e recebido por aqui.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-left border-collapse min-w-[560px]">
                        <thead>
                          <tr>
                            {["Nome", "Categoria", "Data", "Valor", ""].map((h) => (
                              <th key={h} className="text-[10px] font-semibold uppercase tracking-wide px-3 pb-2" style={{ color: COLORS.ink400 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>{renderTableRows(openTableRows, true)}</tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold" style={{ color: COLORS.ink900 }}>Lançamentos pagos</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: COLORS.incomeSoft, color: COLORS.income }}>
                      {paidTableRows.length}
                    </span>
                  </div>
                  {paidTableRows.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: COLORS.ink400 }}>Nada marcado como pago ainda.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-left border-collapse min-w-[560px]">
                        <thead>
                          <tr>
                            {["Nome", "Categoria", "Data", "Valor", ""].map((h) => (
                              <th key={h} className="text-[10px] font-semibold uppercase tracking-wide px-3 pb-2" style={{ color: COLORS.ink400 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>{renderTableRows(paidTableRows, true)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
            <div className="rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ color: COLORS.ink900 }}>
                  {isInvest ? "Meus investimentos" : tabLabel[budgetTab]}
                </span>
                {(isBudget || isInvest) && (
                  <button
                    onClick={() => openAddModal(isInvest ? "investimento" : budgetTab, null)}
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: COLORS.ink900, color: "#fff" }}
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                )}
              </div>

              {tableRows.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: COLORS.ink400 }}>Nenhum resultado encontrado.</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-left border-collapse min-w-[520px]">
                    <thead>
                      <tr>
                        {["Nome", "Categoria", "Data", "Valor", ""].map((h) => (
                          <th key={h} className="text-[10px] font-semibold uppercase tracking-wide px-3 pb-2" style={{ color: COLORS.ink400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{renderTableRows(tableRows, false)}</tbody>
                  </table>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* invest modal */}
      <Modal open={investModalOpen} onClose={() => setInvestModalOpen(false)} title="Investir" subtitle="Quanto da sua receita você reserva pra investir.">
        <div className="text-center mb-3">
          <span className="text-4xl font-bold" style={{ color: COLORS.invest }}>{tempInvestPercent}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={tempInvestPercent}
          onChange={(e) => setInvestPercentFromSlider(parseInt(e.target.value, 10))}
          className="w-full mb-3"
          style={{ accentColor: COLORS.invest }}
        />
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[20, 30, 40, 50].map((p) => (
            <button
              key={p}
              onClick={() => setInvestPercentFromSlider(p)}
              className="text-xs font-medium py-2 rounded-xl"
              style={tempInvestPercent === p ? { background: COLORS.invest, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
            >
              {p}%
            </button>
          ))}
        </div>
        <div className="text-center mb-1">
          <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: COLORS.ink400 }}>Valor a investir</span>
        </div>
        <div className="flex justify-center mb-5">
          {investAmountEditing ? (
            <div className="w-40">
              <CurrencyInput valueCents={tempInvestAmountCents} onChange={setInvestAmountFromInput} autoFocus />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setInvestAmountEditing(true)}
              className="text-2xl font-semibold tabular-nums"
              style={{ color: COLORS.ink900 }}
            >
              {brl(tempInvestAmountCents)}
            </button>
          )}
        </div>
        <p className="text-[11px] text-center mb-4" style={{ color: COLORS.ink400 }}>
          {investAmountEditing ? "O percentual se ajusta sozinho conforme você digita." : "Toque no valor pra digitar. O percentual se ajusta sozinho."}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setInvestModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: COLORS.page, color: COLORS.ink600 }}>Cancelar</button>
          <button onClick={saveInvest} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: COLORS.primary, color: "#fff" }}>Salvar</button>
        </div>
      </Modal>

      {/* add / edit modal */}
      <Modal
        open={addModalOpen}
        onClose={closeAddModal}
        title={
          addModalType === "investimento"
            ? (editingId ? "Editar aporte" : "Novo aporte")
            : `${editingId ? "Editar" : "Nova"} ${addModalType === "receita" ? "receita" : addModalType === "fixa" ? "despesa fixa" : "despesa variável"}`
        }
        subtitle={addModalType === "fixa" ? "Vale deste mês em diante." : addModalType === "investimento" ? "Registre onde esse valor foi investido." : undefined}
      >
        <div className="space-y-3 mb-5">
          <div className={addModalType === "investimento" ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Valor</label>
              <CurrencyInput valueCents={formAmountCents} onChange={setFormAmountCents} autoFocus />
            </div>
            {(addModalType === "receita" || addModalType === "fixa" || addModalType === "variavel") && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1 whitespace-nowrap" style={{ color: COLORS.ink400 }}>
                  {addModalType === "receita" ? "Recebimento (opcional)" : "Pagamento (opcional)"}
                </label>
                <input
                  type="date"
                  value={formPaymentDate}
                  onChange={(e) => setFormPaymentDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 outline-none text-base"
                  style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Descrição</label>
            <TextInput value={formName} onChange={setFormName} placeholder={addModalType === "investimento" ? "Ex: Tesouro Selic" : "Ex: Aluguel"} />
          </div>
          {(addModalType === "variavel" || addModalType === "fixa") && (
            <div className={addModalType === "fixa" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>
                  Status{addModalType === "fixa" ? ` em ${currentMonthLabel}` : ""}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: "aberto", label: "Em aberto" }, { id: "pago", label: "Pago" }].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setFormPaidStatus(s.id)}
                      className="text-xs font-medium py-2 rounded-xl"
                      style={formPaidStatus === s.id ? { background: COLORS.ink900, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {addModalType === "fixa" && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Dia do vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formDueDay}
                    onChange={(e) => setFormDueDay(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full rounded-xl px-3 py-2.5 outline-none text-base"
                    style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                  />
                </div>
              )}
            </div>
          )}
          {addModalType === "receita" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Tipo</label>
              <div className="flex flex-wrap gap-2">
                {INCOME_CATEGORY_PALETTE.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFormCategory(c.id)}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full"
                    style={formCategory === c.id ? { background: c.color, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: formCategory === c.id ? "#fff" : c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {addModalType === "fixa" && (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {fixedCategories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center rounded-full"
                      style={formCategory === c.id ? { background: c.color, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
                    >
                      <button
                        onClick={() => setFormCategory(c.id)}
                        className="flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1 py-1.5 rounded-full"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: formCategory === c.id ? "#fff" : c.color }} />
                        {c.label}
                      </button>
                      <button
                        onClick={() => openCategoryModal("fixa", c)}
                        aria-label={`Editar categoria ${c.label}`}
                        className="pr-2 pl-0.5 py-1.5 rounded-full"
                        style={{ opacity: formCategory === c.id ? 0.85 : 0.6 }}
                      >
                        <Pencil size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => openCategoryModal("fixa")}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full"
                    style={{ background: COLORS.page, color: COLORS.primary, border: `1px dashed ${COLORS.primary}` }}
                  >
                    <Plus size={12} /> Nova categoria
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "fixo", label: "Fixo" },
                    { id: "parcelado", label: "Parcelado" },
                    { id: "assinatura", label: "Assinatura" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFormRecurrenceType(t.id)}
                      className="text-xs font-medium py-2 rounded-xl"
                      style={formRecurrenceType === t.id ? { background: COLORS.ink900, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {formRecurrenceType === "parcelado" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Parcela atual</label>
                    <input
                      type="number"
                      min={1}
                      value={formInstallmentCurrent}
                      onChange={(e) => setFormInstallmentCurrent(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 outline-none text-base"
                      style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Total de parcelas</label>
                    <input
                      type="number"
                      min={1}
                      value={formInstallmentTotal}
                      onChange={(e) => setFormInstallmentTotal(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 outline-none text-base"
                      style={{ background: COLORS.page, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.ink900 }}
                    />
                  </div>
                </div>
              )}
              {formRecurrenceType === "assinatura" && (
                <p className="text-[11px]" style={{ color: COLORS.ink400 }}>
                  Vai continuar cobrando todo mês até você marcar como cancelada.
                </p>
              )}
            </>
          )}
          {addModalType === "variavel" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Categoria</label>
              <div className="flex flex-wrap gap-2">
                {variableCategories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center rounded-full"
                    style={formCategory === c.id ? { background: c.color, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
                  >
                    <button
                      onClick={() => setFormCategory(c.id)}
                      className="flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1 py-1.5 rounded-full"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: formCategory === c.id ? "#fff" : c.color }} />
                      {c.label}
                    </button>
                    <button
                      onClick={() => openCategoryModal("variavel", c)}
                      aria-label={`Editar categoria ${c.label}`}
                      className="pr-2 pl-0.5 py-1.5 rounded-full"
                      style={{ opacity: formCategory === c.id ? 0.85 : 0.6 }}
                    >
                      <Pencil size={10} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => openCategoryModal("variavel")}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full"
                  style={{ background: COLORS.page, color: COLORS.primary, border: `1px dashed ${COLORS.primary}` }}
                >
                  <Plus size={12} /> Nova categoria
                </button>
              </div>
            </div>
          )}
          {addModalType === "investimento" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Tipo</label>
              <div className="flex flex-wrap gap-2">
                {INVEST_CATEGORY_PALETTE.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFormCategory(c.id)}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full"
                    style={formCategory === c.id ? { background: c.color, color: "#fff" } : { background: COLORS.page, color: COLORS.ink600 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: formCategory === c.id ? "#fff" : c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {formError && (
          <p className="text-xs font-medium mb-3" style={{ color: COLORS.expense }}>{formError}</p>
        )}
        <div className="flex gap-2">
          {editingId && (
            <button onClick={handleDelete} disabled={saving} className="p-2.5 rounded-xl disabled:opacity-60" style={{ background: COLORS.expenseSoft }} aria-label="Excluir">
              <Trash2 size={18} style={{ color: COLORS.expense }} />
            </button>
          )}
          <button onClick={closeAddModal} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ background: COLORS.page, color: COLORS.ink600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ background: COLORS.ink900, color: "#fff" }}>
            {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </Modal>

      {/* category modal (create / edit) */}
      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={categoryEditingId ? "Editar categoria" : "Nova categoria"}
        subtitle={categoryModalTarget === "fixa" ? "Pra despesas fixas." : "Pra despesas variáveis."}
      >
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Nome</label>
            <TextInput value={newCategoryName} onChange={setNewCategoryName} placeholder="Ex: Pet, Educação..." />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.ink400 }}>Cor</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer"
                style={{ border: `1px solid ${COLORS.cardBorder}`, background: "none", padding: 2 }}
              />
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full"
                style={{ background: newCategoryColor, color: "#fff" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />
                {newCategoryName.trim() || "Pré-visualização"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {categoryEditingId && (
            <button onClick={deleteCategoryHandler} className="p-2.5 rounded-xl" style={{ background: COLORS.expenseSoft }} aria-label="Excluir categoria">
              <Trash2 size={18} style={{ color: COLORS.expense }} />
            </button>
          )}
          <button onClick={() => setCategoryModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: COLORS.page, color: COLORS.ink600 }}>Cancelar</button>
          <button onClick={saveCategory} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: COLORS.ink900, color: "#fff" }}>
            {categoryEditingId ? "Salvar" : "Criar categoria"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
