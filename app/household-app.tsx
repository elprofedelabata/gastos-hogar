"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  House,
  List,
  Menu,
  Plus,
  ReceiptText,
  Scale,
  ShoppingBasket,
  Tag,
  UserPlus,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import {
  balanceDeltaFor,
  centsToInput,
  eurosToCents,
  formatEuros,
  splitEvenly,
  validateExpense,
  type MoneyShares,
} from "@/lib/domain";

type Profile = {
  id: string;
  name: string;
  initial: string;
};

type Movement = {
  id: string;
  name: string;
  detail: string;
  amountCents: number;
  icon: LucideIcon;
  payments?: MoneyShares;
  allocations?: MoneyShares;
};

const profiles: Profile[] = [
  { id: "dani", name: "Dani", initial: "D" },
  { id: "ana", name: "Ana", initial: "A" },
];

const currentProfileId = "dani";
const baseMonthlyTotalCents = 128_430;
const monthlyBudgetCents = 180_000;
const baseBalanceCents = 8_640;

const initialMovements: Movement[] = [
  {
    id: "mercadona",
    name: "Mercadona",
    detail: "Hoy · pagado por Dani",
    amountCents: 6_235,
    icon: ShoppingBasket,
  },
  {
    id: "electricidad",
    name: "Electricidad",
    detail: "Ayer · pagado por Ana",
    amountCents: 7_810,
    icon: Zap,
  },
  {
    id: "internet",
    name: "Internet",
    detail: "18 ago · pagado por Dani",
    amountCents: 3_990,
    icon: Wifi,
  },
];

const categories = [
  "Supermercado",
  "Suministros",
  "Vivienda",
  "Transporte",
  "Ocio",
  "Salud",
  "Otros",
];

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function inputsFromSplit(totalCents: number, profileIds: string[]) {
  return Object.fromEntries(
    Object.entries(splitEvenly(totalCents, profileIds)).map(([id, cents]) => [
      id,
      centsToInput(cents),
    ]),
  );
}

function valuesToShares(values: Record<string, string>): MoneyShares {
  return Object.fromEntries(
    Object.entries(values).map(([profileId, value]) => [
      profileId,
      eurosToCents(value),
    ]),
  );
}

function profileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? "Persona";
}

function joinedProfileNames(profileIds: string[]) {
  return profileIds.map(profileName).join(" y ");
}

function signedEuros(cents: number) {
  if (cents === 0) return formatEuros(0);
  return `${cents > 0 ? "+" : "−"}${formatEuros(Math.abs(cents))}`;
}

function differenceMessage(difference: number, label: string) {
  if (difference === 0) return null;
  return difference > 0
    ? `Faltan ${formatEuros(difference)} en ${label}`
    : `Sobran ${formatEuros(Math.abs(difference))} en ${label}`;
}

export function HouseholdApp() {
  const [view, setView] = useState<"home" | "expense">("home");
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [addedExpenses, setAddedExpenses] = useState<Movement[]>([]);
  const [notice, setNotice] = useState("");

  const [total, setTotal] = useState("48.60");
  const [category, setCategory] = useState("Supermercado");
  const [date, setDate] = useState(localDateValue);
  const [note, setNote] = useState("");
  const [payerIds, setPayerIds] = useState<string[]>([currentProfileId]);
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({
    [currentProfileId]: "48.60",
  });
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>(
    () => inputsFromSplit(4_860, profiles.map((profile) => profile.id)),
  );
  const [paymentsAutomatic, setPaymentsAutomatic] = useState(true);
  const [allocationsAutomatic, setAllocationsAutomatic] = useState(true);

  const totalCents = eurosToCents(total);
  const payments = useMemo(() => valuesToShares(paymentValues), [paymentValues]);
  const allocations = useMemo(
    () => valuesToShares(allocationValues),
    [allocationValues],
  );
  const validation = useMemo(
    () => validateExpense({ totalCents, payments, allocations }),
    [totalCents, payments, allocations],
  );

  const monthlyTotalCents =
    baseMonthlyTotalCents +
    addedExpenses.reduce((sum, movement) => sum + movement.amountCents, 0);
  const budgetPercent = Math.min(
    100,
    Math.round((monthlyTotalCents / monthlyBudgetCents) * 100),
  );
  const currentBalanceCents =
    baseBalanceCents +
    addedExpenses.reduce(
      (sum, movement) =>
        sum +
        balanceDeltaFor(
          currentProfileId,
          movement.payments ?? {},
          movement.allocations ?? {},
        ),
      0,
    );
  const remainingPayers = profiles.filter(
    (profile) => !payerIds.includes(profile.id),
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openExpense() {
    setNotice("");
    setView("expense");
  }

  function updateTotal(nextValue: string) {
    setTotal(nextValue);
    const nextCents = eurosToCents(nextValue);

    if (paymentsAutomatic) {
      setPaymentValues(inputsFromSplit(nextCents, payerIds));
    }
    if (allocationsAutomatic) {
      setAllocationValues(
        inputsFromSplit(nextCents, profiles.map((profile) => profile.id)),
      );
    }
  }

  function addNextPayer() {
    const nextProfile = remainingPayers[0];
    if (!nextProfile) return;

    const nextPayerIds = [...payerIds, nextProfile.id];
    setPayerIds(nextPayerIds);
    setPaymentValues(inputsFromSplit(totalCents, nextPayerIds));
    setPaymentsAutomatic(true);
  }

  function removePayer(profileId: string) {
    if (payerIds.length === 1) return;
    const nextPayerIds = payerIds.filter((id) => id !== profileId);
    setPayerIds(nextPayerIds);
    setPaymentValues(inputsFromSplit(totalCents, nextPayerIds));
    setPaymentsAutomatic(true);
  }

  function equalizePayments() {
    setPaymentValues(inputsFromSplit(totalCents, payerIds));
    setPaymentsAutomatic(true);
  }

  function equalizeAllocations() {
    setAllocationValues(
      inputsFromSplit(totalCents, profiles.map((profile) => profile.id)),
    );
    setAllocationsAutomatic(true);
  }

  function resetDraft() {
    const defaultCents = 4_860;
    setTotal(centsToInput(defaultCents));
    setCategory("Supermercado");
    setDate(localDateValue());
    setNote("");
    setPayerIds([currentProfileId]);
    setPaymentValues({ [currentProfileId]: centsToInput(defaultCents) });
    setAllocationValues(
      inputsFromSplit(defaultCents, profiles.map((profile) => profile.id)),
    );
    setPaymentsAutomatic(true);
    setAllocationsAutomatic(true);
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.valid) return;

    const newMovement: Movement = {
      id: `expense-${Date.now()}`,
      name: note.trim() || category,
      detail: `Hoy · pagado por ${joinedProfileNames(payerIds)}`,
      amountCents: totalCents,
      icon: category === "Supermercado" ? ShoppingBasket : ReceiptText,
      payments,
      allocations,
    };

    setMovements((current) => [newMovement, ...current]);
    setAddedExpenses((current) => [newMovement, ...current]);
    setNotice("Gasto guardado y balances actualizados");
    setView("home");
    resetDraft();
  }

  const validationMessages = [
    differenceMessage(validation.paymentDifference, "pagadores"),
    differenceMessage(validation.allocationDifference, "el reparto"),
  ].filter(Boolean);

  return (
    <main className="site-shell">
      <section className={`app-frame view-${view}`} aria-label="Gastos del hogar">
        <div className="app-surface">
          {view === "home" ? (
            <>
              <header className="topbar">
                <div>
                  <p className="eyebrow">Buenos días, Dani</p>
                  <h1>Mi casa</h1>
                </div>
                <button className="avatar-button" type="button" aria-label="Abrir perfil">
                  D
                </button>
              </header>

              <div className="page-content">
                {notice ? (
                  <div className="success-notice" role="status">
                    <Check aria-hidden="true" />
                    {notice}
                  </div>
                ) : null}

                <div className="overview-grid">
                  <section className="summary-card" aria-label="Resumen mensual">
                    <div className="summary-heading">
                      <span>Gastos del mes</span>
                      <button type="button" className="month-button">
                        Agosto 2026 <span aria-hidden="true">⌄</span>
                      </button>
                    </div>
                    <p className="monthly-total">{formatEuros(monthlyTotalCents)}</p>
                    <div className="budget-copy">
                      <span>Presupuesto</span>
                      <span>
                        {formatEuros(monthlyTotalCents)} de {formatEuros(monthlyBudgetCents)}
                      </span>
                    </div>
                    <div
                      className="budget-track"
                      role="progressbar"
                      aria-label="Presupuesto utilizado"
                      aria-valuenow={budgetPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${budgetPercent}%` }} />
                    </div>
                  </section>

                  <section className="balance-card" aria-label="Tu balance">
                    <div>
                      <p className="card-label">Tu balance</p>
                      <p className="balance-amount">{signedEuros(currentBalanceCents)}</p>
                      <p className="supporting-copy">
                        {currentBalanceCents >= 0 ? "A tu favor" : "Pendiente de aportar"}
                      </p>
                    </div>
                    <button type="button" className="text-action" disabled>
                      Ver cuentas <ArrowRight aria-hidden="true" />
                    </button>
                  </section>
                </div>

                <button type="button" className="primary-action" onClick={openExpense}>
                  <Plus aria-hidden="true" /> Añadir gasto
                </button>

                <section className="movements-section" aria-labelledby="recent-title">
                  <div className="section-heading">
                    <h2 id="recent-title">Movimientos recientes</h2>
                    <button type="button" className="text-action" disabled>
                      Ver todos
                    </button>
                  </div>

                  <div className="movement-list">
                    {movements.map((movement) => {
                      const Icon = movement.icon;
                      return (
                        <button className="movement-row" type="button" key={movement.id}>
                          <span className="movement-main">
                            <span className="category-mark" aria-hidden="true">
                              <Icon />
                            </span>
                            <span>
                              <strong>{movement.name}</strong>
                              <small>{movement.detail}</small>
                            </span>
                          </span>
                          <span className="movement-amount">
                            −{formatEuros(movement.amountCents)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <>
              <header className="editor-header">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setView("home")}
                  aria-label="Volver a inicio"
                >
                  <ArrowLeft aria-hidden="true" />
                </button>
                <div>
                  <p className="eyebrow">Nuevo movimiento</p>
                  <h1>Registrar gasto</h1>
                </div>
              </header>

              <form className="expense-form" onSubmit={saveExpense}>
                <div className="amount-field">
                  <label htmlFor="expense-total">Importe</label>
                  <div>
                    <input
                      id="expense-total"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={total}
                      onChange={(event) => updateTotal(event.target.value)}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <span>€</span>
                  </div>
                </div>

                <div className="basic-fields">
                  <label className="select-field">
                    <Tag aria-hidden="true" />
                    <span>
                      <small>Categoría</small>
                      <select value={category} onChange={(event) => setCategory(event.target.value)}>
                        {categories.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className="date-field">
                    <CalendarDays aria-hidden="true" />
                    <span>
                      <small>Fecha</small>
                      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                    </span>
                  </label>
                </div>

                <section className="form-section" aria-labelledby="payers-title">
                  <div className="form-section-heading">
                    <div>
                      <h2 id="payers-title">Pagado por</h2>
                      <p>Quién adelantó el dinero</p>
                    </div>
                    {remainingPayers.length ? (
                      <button type="button" className="inline-action" onClick={addNextPayer}>
                        <UserPlus aria-hidden="true" /> Añadir
                      </button>
                    ) : null}
                  </div>

                  <div className="share-list">
                    {payerIds.map((profileId) => {
                      const profile = profiles.find((item) => item.id === profileId)!;
                      const shareCents = eurosToCents(paymentValues[profileId] ?? "0");
                      const percentage = totalCents
                        ? Math.round((shareCents / totalCents) * 100)
                        : 0;

                      return (
                        <div className="share-row" key={profileId}>
                          <span className="person-identity">
                            <span className="person-avatar">{profile.initial}</span>
                            <span>
                              <strong>{profile.name}</strong>
                              <small>{percentage}% del pago</small>
                            </span>
                          </span>
                          <span className="money-control">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={paymentValues[profileId] ?? ""}
                              onChange={(event) => {
                                setPaymentValues((current) => ({
                                  ...current,
                                  [profileId]: event.target.value,
                                }));
                                setPaymentsAutomatic(false);
                              }}
                              onFocus={(event) => event.currentTarget.select()}
                              aria-label={`Cantidad pagada por ${profile.name}`}
                            />
                            <span>€</span>
                            {payerIds.length > 1 ? (
                              <button
                                type="button"
                                className="remove-person"
                                onClick={() => removePayer(profileId)}
                                aria-label={`Quitar a ${profile.name} como pagador`}
                              >
                                <X aria-hidden="true" />
                              </button>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {payerIds.length > 1 ? (
                    <button type="button" className="section-action" onClick={equalizePayments}>
                      Repartir el pago por igual
                    </button>
                  ) : null}
                </section>

                <section className="form-section" aria-labelledby="allocations-title">
                  <div className="form-section-heading">
                    <div>
                      <h2 id="allocations-title">Repartido entre</h2>
                      <p>A quién corresponde el gasto</p>
                    </div>
                    <button type="button" className="inline-action" onClick={equalizeAllocations}>
                      Repartir igual
                    </button>
                  </div>

                  <div className="share-list">
                    {profiles.map((profile) => {
                      const shareCents = eurosToCents(allocationValues[profile.id] ?? "0");
                      const percentage = totalCents
                        ? Math.round((shareCents / totalCents) * 100)
                        : 0;

                      return (
                        <div className="share-row" key={profile.id}>
                          <span className="person-identity">
                            <span className="person-avatar">{profile.initial}</span>
                            <span>
                              <strong>{profile.name}</strong>
                              <small>{percentage}% del gasto</small>
                            </span>
                          </span>
                          <span className="money-control">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={allocationValues[profile.id] ?? ""}
                              onChange={(event) => {
                                setAllocationValues((current) => ({
                                  ...current,
                                  [profile.id]: event.target.value,
                                }));
                                setAllocationsAutomatic(false);
                              }}
                              onFocus={(event) => event.currentTarget.select()}
                              aria-label={`Parte del gasto correspondiente a ${profile.name}`}
                            />
                            <span>€</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <label className="note-field">
                  <span>Nota <small>· opcional</small></span>
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Por ejemplo, compra semanal"
                  />
                </label>

                <div
                  className={`validation-summary ${validation.valid ? "is-valid" : "is-error"}`}
                  role="status"
                >
                  {validation.valid ? (
                    <>
                      <span><Check aria-hidden="true" /> Todo cuadra</span>
                      <strong>{formatEuros(totalCents)}</strong>
                    </>
                  ) : (
                    <span>{validationMessages.join(" · ") || "Introduce un importe válido"}</span>
                  )}
                </div>

                <button type="submit" className="save-action" disabled={!validation.valid}>
                  Guardar gasto
                </button>
              </form>
            </>
          )}
        </div>

        <nav className="bottom-navigation" aria-label="Navegación principal">
          <div className="nav-brand" aria-hidden="true">
            <span><House /></span>
            <strong>Mi casa</strong>
            <small>Gastos del hogar</small>
          </div>
          <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}>
            <House aria-hidden="true" />
            Inicio
          </button>
          <button type="button" disabled>
            <List aria-hidden="true" />
            Movimientos
          </button>
          <button type="button" className="nav-add" onClick={openExpense} aria-label="Añadir gasto">
            <Plus aria-hidden="true" />
          </button>
          <button type="button" disabled>
            <Scale aria-hidden="true" />
            Cuentas
          </button>
          <button type="button" disabled>
            <Menu aria-hidden="true" />
            Más
          </button>
        </nav>
      </section>
    </main>
  );
}
