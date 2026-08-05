import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------- */
/*  Row <-> app-shape mapping (DB is snake_case, app state is camelCase)  */
/* ---------------------------------------------------------------------- */

function rowToIncome(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amountCents: row.amount_cents,
    date: row.date,
    receiptDate: row.receipt_date,
    received: !!row.received,
    referenceMonth: row.reference_month,
    recurring: !!row.recurring,
    startMonth: row.start_month,
    receivedMonths: row.received_months || {},
  };
}
function incomeToRow(entry) {
  return {
    name: entry.name,
    category: entry.category,
    amount_cents: entry.amountCents,
    date: entry.date ?? null,
    receipt_date: entry.receiptDate ?? null,
    received: !!entry.received,
    reference_month: entry.referenceMonth ?? null,
    recurring: !!entry.recurring,
    start_month: entry.startMonth ?? null,
    received_months: entry.receivedMonths || {},
  };
}

function rowToFixed(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amountCents: row.amount_cents,
    date: row.date,
    installment: row.installment_current && row.installment_total
      ? { current: row.installment_current, total: row.installment_total }
      : null,
    subscription: !!row.subscription,
    dueDay: row.due_day,
    startMonth: row.start_month,
    paidMonths: row.paid_months || {},
  };
}
function fixedToRow(entry) {
  return {
    name: entry.name,
    category: entry.category,
    amount_cents: entry.amountCents,
    date: entry.date ?? null,
    installment_current: entry.installment ? entry.installment.current : null,
    installment_total: entry.installment ? entry.installment.total : null,
    subscription: !!entry.subscription,
    due_day: entry.dueDay ?? null,
    start_month: entry.startMonth,
    paid_months: entry.paidMonths || {},
  };
}

function rowToVariable(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amountCents: row.amount_cents,
    date: row.date,
    paymentDate: row.payment_date,
    paid: !!row.paid,
    deferred: !!row.deferred,
    referenceMonth: row.reference_month,
  };
}
function variableToRow(entry) {
  return {
    name: entry.name,
    category: entry.category,
    amount_cents: entry.amountCents,
    date: entry.date ?? null,
    payment_date: entry.paymentDate ?? null,
    paid: !!entry.paid,
    deferred: !!entry.deferred,
    reference_month: entry.referenceMonth,
  };
}

function rowToInvest(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amountCents: row.amount_cents,
    date: row.date,
    paid: !!row.paid,
    paymentDate: row.payment_date,
  };
}
function investToRow(entry) {
  return {
    name: entry.name,
    category: entry.category,
    amount_cents: entry.amountCents,
    date: entry.date ?? null,
    paid: !!entry.paid,
    payment_date: entry.paymentDate ?? null,
  };
}

function rowToCategory(row) {
  return { id: row.id, label: row.label, color: row.color };
}

function rowToSettings(row) {
  return {
    // numeric columns come back from PostgREST as strings to avoid float precision loss
    investPercent: row.invest_percent != null ? parseFloat(row.invest_percent) : 0,
    categoryBudgets: row.category_budgets ?? {},
    categoriesSeeded: row.categories_seeded ?? false,
  };
}

const TABLES = {
  receita: "income",
  fixa: "fixed_expenses",
  variavel: "variable_expenses",
  investimento: "invest_allocations",
};

const MAPPERS = {
  receita: { toRow: incomeToRow, fromRow: rowToIncome },
  fixa: { toRow: fixedToRow, fromRow: rowToFixed },
  variavel: { toRow: variableToRow, fromRow: rowToVariable },
  investimento: { toRow: investToRow, fromRow: rowToInvest },
};

/* ---------------------------------------------------------------------- */
/*  CRUD                                                                   */
/* ---------------------------------------------------------------------- */

export async function fetchAllData(userId) {
  const [incomeRes, fixedRes, variableRes, investRes, varCatRes, fixedCatRes, settingsRes] = await Promise.all([
    supabase.from("income").select("*").order("created_at"),
    supabase.from("fixed_expenses").select("*").order("created_at"),
    supabase.from("variable_expenses").select("*").order("created_at"),
    supabase.from("invest_allocations").select("*").order("created_at"),
    supabase.from("variable_categories").select("*").eq("user_id", userId),
    supabase.from("fixed_categories").select("*").eq("user_id", userId),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const failed = [incomeRes, fixedRes, variableRes, investRes, varCatRes, fixedCatRes, settingsRes].find((r) => r.error);
  if (failed) throw failed.error;
  return {
    income: incomeRes.data.map(rowToIncome),
    fixedExpenses: fixedRes.data.map(rowToFixed),
    variableExpenses: variableRes.data.map(rowToVariable),
    investAllocations: investRes.data.map(rowToInvest),
    variableCategories: varCatRes.data.map(rowToCategory),
    fixedCategories: fixedCatRes.data.map(rowToCategory),
    settings: settingsRes.data ? rowToSettings(settingsRes.data) : { investPercent: 0, categoryBudgets: {}, categoriesSeeded: false },
  };
}

export async function insertEntry(kind, entry, userId) {
  const table = TABLES[kind];
  const payload = { ...MAPPERS[kind].toRow(entry), user_id: userId };
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return MAPPERS[kind].fromRow(data);
}

export async function updateEntry(kind, id, entry) {
  const table = TABLES[kind];
  const payload = MAPPERS[kind].toRow(entry);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return MAPPERS[kind].fromRow(data);
}

export async function patchEntry(kind, id, partialRow) {
  const table = TABLES[kind];
  const { data, error } = await supabase.from(table).update(partialRow).eq("id", id).select().single();
  if (error) throw error;
  return MAPPERS[kind].fromRow(data);
}

export async function deleteEntry(kind, id) {
  const table = TABLES[kind];
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function insertCategory(target, category, userId) {
  const table = target === "fixa" ? "fixed_categories" : "variable_categories";
  const { error } = await supabase
    .from(table)
    .insert({ id: category.id, label: category.label, color: category.color, user_id: userId });
  if (error) throw error;
}

export async function seedCategories(target, categories, userId) {
  if (!categories.length) return;
  const table = target === "fixa" ? "fixed_categories" : "variable_categories";
  const rows = categories.map((c) => ({ id: c.id, label: c.label, color: c.color, user_id: userId }));
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

export async function updateCategory(target, id, { label, color }, userId) {
  const table = target === "fixa" ? "fixed_categories" : "variable_categories";
  const { error } = await supabase.from(table).update({ label, color }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteCategory(target, id, userId) {
  const table = target === "fixa" ? "fixed_categories" : "variable_categories";
  const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function upsertSettings(userId, { investPercent, categoryBudgets, categoriesSeeded }) {
  const row = { user_id: userId, invest_percent: investPercent, category_budgets: categoryBudgets };
  if (categoriesSeeded !== undefined) row.categories_seeded = categoriesSeeded;
  const { error } = await supabase.from("settings").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

export function describeSupabaseError(error) {
  const msg = error?.message || "";
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("User already registered")) return "Já existe uma conta com esse e-mail.";
  if (msg.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Unable to validate email address")) return "Digite um e-mail válido.";
  return msg || "Algo deu errado. Tente novamente.";
}
