import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Eraser,
  House,
  List,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Repeat2,
  Scale,
  ShoppingBasket,
  Tag,
  Trash2,
  UsersRound,
  WandSparkles,
  WalletCards,
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
import {
  useExpenses,
  type Expense,
  type ExpenseStoreMode,
  type HouseholdSettings,
} from "@/lib/expenses";

type Profile = {
  id: string;
  name: string;
  initial: string;
};

const defaultProfiles: Profile[] = [
  { id: "dani", name: "Dani", initial: "D" },
  { id: "ana", name: "Tati", initial: "T" },
];

const currentProfileId = "dani";
const expenseSheetTransitionMs = 360;
const categories = ["Supermercado", "Suministros", "Vivienda", "Transporte", "Ocio", "Salud", "Otros"];

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function inputsFromSplit(totalCents: number, profileIds: string[]) {
  return Object.fromEntries(
    Object.entries(splitEvenly(totalCents, profileIds)).map(([id, cents]) => [id, centsToInput(cents)]),
  );
}

function valuesToShares(values: Record<string, string>): MoneyShares {
  return Object.fromEntries(
    Object.entries(values).map(([profileId, value]) => [profileId, eurosToCents(value)]),
  );
}

function profileName(profileId: string, profiles: Profile[]) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? "Persona";
}

function profileFor(profileId: string, profiles: Profile[]): Profile {
  return profiles.find((profile) => profile.id === profileId) ?? { id: profileId, name: "Persona", initial: "?" };
}

function joinedProfileNames(profileIds: string[], profiles: Profile[]) {
  return profileIds.map((profileId) => profileName(profileId, profiles)).join(" y ");
}

function paidBy(expense: Expense, profiles: Profile[]) {
  return joinedProfileNames(
    Object.entries(expense.payments).filter(([, cents]) => cents > 0).map(([profileId]) => profileId),
    profiles,
  );
}

function movementBalanceDeltaFor(profileId: string, movement: Expense) {
  if (movement.kind === "settlement") {
    if (movement.settlementFromProfileId === profileId) return movement.amountCents;
    if (movement.settlementToProfileId === profileId) return -movement.amountCents;
    return 0;
  }
  return balanceDeltaFor(profileId, movement.payments, movement.allocations);
}

function settlementDescription(movement: Expense, profiles: Profile[]) {
  return `${profileName(movement.settlementFromProfileId ?? "", profiles)} → ${profileName(movement.settlementToProfileId ?? "", profiles)}`;
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

function categoryIcon(category: string) {
  if (category === "Ajuste") return <ArrowLeftRight />;
  if (category === "Supermercado") return <ShoppingBasket />;
  if (category === "Suministros") return <Zap />;
  if (category === "Vivienda") return <House />;
  return <ReceiptText />;
}

function movementDate(date: string) {
  const today = localDateValue();
  if (date === today) return "Hoy";
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Ayer";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(parsed);
}

function fullMovementDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

type MovementRowProps = {
  expense: Expense;
  profiles: Profile[];
  onOpen: (expense: Expense) => void;
};

function MovementRow({ expense, profiles, onOpen }: MovementRowProps) {
  const isSettlement = expense.kind === "settlement";

  return (
    <button className={`movement-row${isSettlement ? " is-settlement" : ""}`} type="button" onClick={() => onOpen(expense)}>
      <span className="movement-main">
        <span className="category-mark" aria-hidden="true">{categoryIcon(expense.category)}</span>
        <span><strong>{expense.name}</strong><small>{movementDate(expense.date)} · {isSettlement ? settlementDescription(expense, profiles) : `pagado por ${paidBy(expense, profiles)}`}</small></span>
      </span>
      <span className="movement-amount">{isSettlement ? formatEuros(expense.amountCents) : `−${formatEuros(expense.amountCents)}`}</span>
    </button>
  );
}

type ExpenseDetailModalProps = {
  expense: Expense;
  profiles: Profile[];
  currentProfile: Profile;
  onDelete: (expense: Expense) => Promise<void>;
  onClose: () => void;
};

function ExpenseDetailModal({ expense, profiles, currentProfile, onDelete, onClose }: ExpenseDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const isSettlement = expense.kind === "settlement";
  const paymentEntries = Object.entries(expense.payments).filter(([, cents]) => cents > 0);
  const currentBalanceImpact = movementBalanceDeltaFor(currentProfile.id, expense);
  const settlementFrom = profileFor(expense.settlementFromProfileId ?? "", profiles);
  const settlementTo = profileFor(expense.settlementToProfileId ?? "", profiles);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (confirmingDelete) cancelDeleteButtonRef.current?.focus();
  }, [confirmingDelete]);

  function requestClose() {
    if (!deleting) dialogRef.current?.close();
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(expense);
      dialogRef.current?.close();
    } catch {
      setDeleteError("No se ha podido eliminar. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="expense-dialog" aria-labelledby="expense-detail-title" onCancel={(event) => { if (deleting) event.preventDefault(); }} onClose={onClose}>
      <button type="button" className="expense-dialog-backdrop" onClick={requestClose} tabIndex={-1} aria-label="Cerrar detalle" disabled={deleting} />
      <div className="expense-dialog-content">
        <header className="expense-dialog-header">
          <span className="expense-dialog-icon" aria-hidden="true">{categoryIcon(expense.category)}</span>
          <div><p className="eyebrow">{expense.category}</p><h2 id="expense-detail-title">{expense.name}</h2></div>
          <button ref={closeButtonRef} type="button" className="icon-button dialog-close" onClick={requestClose} aria-label="Cerrar detalle" disabled={deleting}><X aria-hidden="true" /></button>
        </header>

        <p className="expense-dialog-amount">{isSettlement ? "" : "−"}{formatEuros(expense.amountCents)}</p>
        <p className="expense-dialog-date"><CalendarDays aria-hidden="true" /> {fullMovementDate(expense.date)}</p>

        {isSettlement ? (
          <section className="settlement-transfer" aria-label="Transferencia registrada">
            <div><span className="person-avatar">{settlementFrom.initial}</span><strong>{settlementFrom.name}</strong><small>Paga</small></div>
            <span className="settlement-transfer-arrow" aria-hidden="true"><ArrowRight /></span>
            <div><span className="person-avatar">{settlementTo.initial}</span><strong>{settlementTo.name}</strong><small>Recibe</small></div>
          </section>
        ) : (
          <div className="expense-detail-grid">
            <section className="expense-detail-section" aria-labelledby="detail-payments-title">
              <h3 id="detail-payments-title">Pagado por</h3>
              {paymentEntries.map(([profileId, cents]) => {
                const profile = profileFor(profileId, profiles);
                return <div className="expense-detail-person" key={profileId}><span className="person-avatar">{profile.initial}</span><strong>{profile.name}</strong><strong>{formatEuros(cents)}</strong></div>;
              })}
            </section>
          </div>
        )}

        <div className="expense-balance-impact"><span>{isSettlement ? `Cambio en el balance de ${currentProfile.name}` : `Impacto en el balance de ${currentProfile.name}`}</span><strong className={currentBalanceImpact >= 0 ? "is-positive" : "is-negative"}>{signedEuros(currentBalanceImpact)}</strong></div>

        {confirmingDelete ? (
          <section className="delete-confirmation" aria-labelledby="delete-confirmation-title">
            <div><strong id="delete-confirmation-title">¿Eliminar este movimiento?</strong><p>No se puede deshacer y las cuentas se recalcularán.</p></div>
            {deleteError ? <p className="delete-error" role="alert">{deleteError}</p> : null}
            <div className="delete-confirmation-actions">
              <button ref={cancelDeleteButtonRef} type="button" className="secondary-action" onClick={() => { setConfirmingDelete(false); setDeleteError(""); }} disabled={deleting}>Conservar</button>
              <button type="button" className="delete-confirm-action" onClick={() => void confirmDelete()} disabled={deleting}><Trash2 aria-hidden="true" />{deleting ? "Eliminando…" : "Sí, eliminar"}</button>
            </div>
          </section>
        ) : (
          <button type="button" className="delete-movement-action" onClick={() => setConfirmingDelete(true)}><Trash2 aria-hidden="true" />Eliminar movimiento</button>
        )}
      </div>
    </dialog>
  );
}

type SettlementProposal = {
  from: Profile;
  to: Profile;
  amountCents: number;
};

type SettlementConfirmModalProps = {
  proposal: SettlementProposal;
  saving: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

function SettlementConfirmModal({ proposal, saving, onConfirm, onClose }: SettlementConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    }
  }, []);

  function requestClose() {
    if (!saving) dialogRef.current?.close();
  }

  return (
    <dialog ref={dialogRef} className="expense-dialog settlement-dialog" aria-labelledby="settlement-confirm-title" onClose={onClose}>
      <button type="button" className="expense-dialog-backdrop" onClick={requestClose} tabIndex={-1} aria-label="Cancelar ajuste" disabled={saving} />
      <div className="expense-dialog-content">
        <header className="expense-dialog-header">
          <span className="expense-dialog-icon" aria-hidden="true"><ArrowLeftRight /></span>
          <div><p className="eyebrow">Ajustar cuentas</p><h2 id="settlement-confirm-title">Confirmar el pago</h2></div>
          <button type="button" className="icon-button dialog-close" onClick={requestClose} aria-label="Cerrar confirmación" disabled={saving}><X aria-hidden="true" /></button>
        </header>

        <p className="settlement-confirm-copy"><strong>{proposal.from.name}</strong> pagará <strong>{formatEuros(proposal.amountCents)}</strong> a <strong>{proposal.to.name}</strong>.</p>
        <p className="settlement-confirm-note">Se añadirá un movimiento de ajuste y las cuentas quedarán saldadas. Este importe no contará como gasto del mes.</p>

        <div className="settlement-dialog-actions">
          <button ref={cancelButtonRef} type="button" className="secondary-action" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="save-action" onClick={() => void onConfirm()} disabled={saving}>{saving ? "Registrando…" : "Confirmar ajuste"}</button>
        </div>
      </div>
    </dialog>
  );
}

type HouseholdSettingKey = "name" | "people" | "budget";

type HouseholdSettingsModalProps = {
  setting: HouseholdSettingKey;
  settings: HouseholdSettings;
  onSave: (settings: HouseholdSettings) => Promise<void>;
  onClose: () => void;
};

function HouseholdSettingsModal({ setting, settings, onSave, onClose }: HouseholdSettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [householdName, setHouseholdName] = useState(settings.householdName);
  const [daniName, setDaniName] = useState(settings.profileNames.dani);
  const [anaName, setAnaName] = useState(settings.profileNames.ana);
  const [budget, setBudget] = useState(centsToInput(settings.monthlyBudgetCents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const budgetCents = eurosToCents(budget);
  const valid = setting === "name"
    ? Boolean(householdName.trim())
    : setting === "people"
      ? Boolean(daniName.trim() && anaName.trim())
      : budgetCents > 0;
  const title = setting === "name" ? "Nombre del hogar" : setting === "people" ? "Personas" : "Presupuesto mensual";
  const eyebrow = setting === "people" ? "Quién forma parte" : setting === "budget" ? "Límite orientativo" : "Identidad del hogar";
  const icon = setting === "name" ? <House /> : setting === "people" ? <UsersRound /> : <WalletCards />;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      firstInputRef.current?.focus();
      firstInputRef.current?.select();
    }
  }, []);

  function requestClose() {
    if (!saving) dialogRef.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        householdName: householdName.trim(),
        profileNames: { dani: daniName.trim(), ana: anaName.trim() },
        monthlyBudgetCents: budgetCents,
      });
      dialogRef.current?.close();
    } catch {
      setError("No se han podido guardar los cambios. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="expense-dialog household-settings-dialog" aria-labelledby="household-settings-dialog-title" onCancel={(event) => { event.preventDefault(); requestClose(); }} onClose={onClose}>
      <button type="button" className="expense-dialog-backdrop" onClick={requestClose} tabIndex={-1} aria-label="Cerrar configuración" disabled={saving} />
      <div className="expense-dialog-content">
        <header className="expense-dialog-header">
          <span className="expense-dialog-icon" aria-hidden="true">{icon}</span>
          <div><p className="eyebrow">{eyebrow}</p><h2 id="household-settings-dialog-title">{title}</h2></div>
          <button type="button" className="icon-button dialog-close" onClick={requestClose} aria-label="Cerrar configuración" disabled={saving}><X aria-hidden="true" /></button>
        </header>

        <form className="household-settings-form" onSubmit={submit}>
          {setting === "name" ? (
            <label>Nombre del hogar<input ref={firstInputRef} type="text" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} maxLength={40} required /><small>Aparecerá como título principal de la aplicación.</small></label>
          ) : setting === "people" ? (
            <div className="household-people-fields">
              <label><span><i>{daniName.trim().charAt(0).toUpperCase() || "1"}</i>Primera persona</span><input ref={firstInputRef} type="text" value={daniName} onChange={(event) => setDaniName(event.target.value)} maxLength={40} required /></label>
              <label><span><i>{anaName.trim().charAt(0).toUpperCase() || "2"}</i>Segunda persona</span><input type="text" value={anaName} onChange={(event) => setAnaName(event.target.value)} maxLength={40} required /></label>
              <p>Los nombres cambiarán en toda la aplicación sin alterar los movimientos guardados.</p>
            </div>
          ) : (
            <label>Presupuesto mensual<div className="settings-money-input"><input ref={firstInputRef} type="number" inputMode="decimal" min="0.01" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} required /><span>€</span></div><small>Se utilizará para calcular la barra de presupuesto de Inicio.</small></label>
          )}

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="household-settings-actions">
            <button type="button" className="secondary-action" onClick={requestClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="save-action" disabled={!valid || saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function modeLabel(mode: ExpenseStoreMode) {
  if (mode === "synced") return "Sincronizado";
  if (mode === "connecting") return "Conectando";
  if (mode === "error") return "Sin conexión";
  return "Modo local";
}

type ProfileToolsProps = {
  mode: ExpenseStoreMode;
  profile: Profile;
  onSignOut?: () => Promise<void>;
};

function ProfileTools({ mode, profile, onSignOut }: ProfileToolsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeFromOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  async function selectSignOut() {
    setOpen(false);
    await onSignOut?.();
  }

  return (
    <div className="profile-tools">
      <span className={`sync-badge is-${mode}`}>{modeLabel(mode)}</span>
      <div className="profile-menu" ref={menuRef}>
        <button
          ref={triggerRef}
          className="avatar-button"
          type="button"
          aria-label={`Abrir menú de ${profile.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? "profile-dropdown" : undefined}
          onClick={() => setOpen((current) => !current)}
          title={`Menú de ${profile.name}`}
        >{profile.initial}</button>
        {open ? (
          <div className="profile-dropdown" id="profile-dropdown" role="menu">
            <button type="button" role="menuitem" onClick={() => void selectSignOut()} disabled={!onSignOut}><LogOut aria-hidden="true" />Cerrar sesión</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential")) return "El correo o la contraseña no son correctos";
  if (code.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos";
  return "No se ha podido iniciar sesión";
}

type AccessScreenProps = {
  mode: ExpenseStoreMode;
  onSignIn: (email: string, password: string) => Promise<void>;
};

function AccessScreen({ mode, onSignIn }: AccessScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (error) {
      setFormError(authErrorMessage(error));
      setSubmitting(false);
    }
  }

  const checking = mode === "connecting" && !submitting;

  return (
    <main className="site-shell">
      <section className="app-frame access-frame" aria-label="Acceso a los gastos del hogar">
        <div className="access-card">
          <span className="access-logo" aria-hidden="true"><House /></span>
          <p className="eyebrow">Mi casa</p>
          <h1>{checking ? "Comprobando acceso" : "Acceso familiar"}</h1>
          <p className="access-copy">
            {checking
              ? "Estamos recuperando la sesión guardada en este dispositivo."
              : "Inicia sesión con la cuenta del hogar para ver y actualizar los gastos compartidos."}
          </p>

          {checking ? (
            <div className="access-loading" role="status">Conectando con Firebase…</div>
          ) : (
            <form className="access-form" onSubmit={submit}>
              <label>
                Correo
                <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label>
                Contraseña
                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              {formError ? <p className="form-error" role="alert">{formError}</p> : null}
              <button className="save-action" type="submit" disabled={submitting}>
                <LockKeyhole aria-hidden="true" /> {submitting ? "Entrando…" : "Entrar"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export function HouseholdApp() {
  const { expenses, householdSettings, mode, error: storeError, isFirebaseConfigured, addExpense, addSettlement, deleteExpense, updateHouseholdSettings, signIn, signOut } = useExpenses();
  const [view, setView] = useState<"home" | "movements" | "accounts" | "more">("home");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [editingHouseholdSetting, setEditingHouseholdSetting] = useState<HouseholdSettingKey | null>(null);
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState("48.60");
  const [category, setCategory] = useState("Supermercado");
  const [date, setDate] = useState(localDateValue);
  const [note, setNote] = useState("");
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({ dani: "", ana: "" });
  const expenseDialogRef = useRef<HTMLDialogElement>(null);
  const expenseCloseTimerRef = useRef<number | null>(null);
  const expenseAfterCloseRef = useRef<(() => void) | null>(null);

  const profiles = useMemo(() => defaultProfiles.map((profile) => {
    const name = profile.id === "dani" ? householdSettings.profileNames.dani : householdSettings.profileNames.ana;
    return { ...profile, name, initial: name.trim().charAt(0).toUpperCase() || profile.initial };
  }), [householdSettings.profileNames.ana, householdSettings.profileNames.dani]);
  const currentProfile = profileFor(currentProfileId, profiles);
  const monthlyBudgetCents = householdSettings.monthlyBudgetCents;
  const totalCents = eurosToCents(total);
  const sortedExpenses = useMemo(
    () => [...expenses].sort((left, right) => right.date.localeCompare(left.date) || right.createdAtMillis - left.createdAtMillis),
    [expenses],
  );
  const expenseMovements = sortedExpenses.filter((expense) => expense.kind === "expense");
  const payments = useMemo(() => valuesToShares(paymentValues), [paymentValues]);
  const validation = useMemo(
    () => validateExpense({ totalCents, payments }),
    [totalCents, payments],
  );
  const currentMonth = localDateValue().slice(0, 7);
  const monthlyExpenses = expenseMovements.filter((expense) => expense.date.startsWith(currentMonth));
  const monthlyTotalCents = monthlyExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const budgetPercent = Math.min(100, Math.round((monthlyTotalCents / monthlyBudgetCents) * 100));
  const currentBalanceCents = sortedExpenses.reduce(
    (sum, expense) => sum + movementBalanceDeltaFor(currentProfileId, expense),
    0,
  );
  const accountSummaries = profiles.map((profile) => {
    const paidCents = expenseMovements.reduce((sum, expense) => sum + (expense.payments[profile.id] ?? 0), 0);
    const allocatedCents = expenseMovements.reduce((sum, expense) => sum + (expense.allocations[profile.id] ?? 0), 0);
    const settlementCents = sortedExpenses
      .filter((movement) => movement.kind === "settlement")
      .reduce((sum, movement) => sum + movementBalanceDeltaFor(profile.id, movement), 0);
    const contributedCents = paidCents + settlementCents;
    return { profile, contributedCents, allocatedCents, balanceCents: contributedCents - allocatedCents };
  });
  const contributionScaleCents = Math.max(1, ...accountSummaries.flatMap((account) => [account.contributedCents, account.allocatedCents]));
  const debtor = accountSummaries.find((account) => account.balanceCents < 0);
  const creditor = accountSummaries.find((account) => account.balanceCents > 0);
  const settlementProposal: SettlementProposal | null = debtor && creditor
    ? { from: debtor.profile, to: creditor.profile, amountCents: Math.min(Math.abs(debtor.balanceCents), creditor.balanceCents) }
    : null;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!expenseOpen) return;
    const dialog = expenseDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    let revealFrame = 0;
    const prepareFrame = window.requestAnimationFrame(() => {
      revealFrame = window.requestAnimationFrame(() => setExpenseVisible(true));
    });

    return () => {
      window.cancelAnimationFrame(prepareFrame);
      window.cancelAnimationFrame(revealFrame);
    };
  }, [expenseOpen]);

  useEffect(() => () => {
    if (expenseCloseTimerRef.current !== null) window.clearTimeout(expenseCloseTimerRef.current);
  }, []);

  if (isFirebaseConfigured && (mode === "auth-required" || (mode === "connecting" && expenses.length === 0))) {
    return <AccessScreen mode={mode} onSignIn={signIn} />;
  }

  function openExpense() {
    if (expenseCloseTimerRef.current !== null) {
      window.clearTimeout(expenseCloseTimerRef.current);
      expenseCloseTimerRef.current = null;
    }
    expenseAfterCloseRef.current = null;
    setNotice("");
    setSelectedExpense(null);
    setExpenseVisible(false);
    setExpenseOpen(true);
  }

  function finishExpenseClose() {
    if (expenseCloseTimerRef.current !== null) {
      window.clearTimeout(expenseCloseTimerRef.current);
      expenseCloseTimerRef.current = null;
    }
    const dialog = expenseDialogRef.current;
    if (dialog?.open) dialog.close();
    else handleExpenseDialogClose();
  }

  function handleExpenseDialogClose() {
    if (expenseCloseTimerRef.current !== null) {
      window.clearTimeout(expenseCloseTimerRef.current);
      expenseCloseTimerRef.current = null;
    }
    setExpenseVisible(false);
    setExpenseOpen(false);
    const afterClose = expenseAfterCloseRef.current;
    expenseAfterCloseRef.current = null;
    afterClose?.();
  }

  function closeExpense(afterClose?: () => void) {
    if (afterClose) expenseAfterCloseRef.current = afterClose;
    if (expenseCloseTimerRef.current !== null) return;

    setExpenseVisible(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    expenseCloseTimerRef.current = window.setTimeout(
      finishExpenseClose,
      reducedMotion ? 0 : expenseSheetTransitionMs + 80,
    );
  }

  function openHome() {
    setSelectedExpense(null);
    setEditingHouseholdSetting(null);
    setView("home");
  }

  function openMovements() {
    setNotice("");
    setSelectedExpense(null);
    setEditingHouseholdSetting(null);
    setView("movements");
  }

  function openAccounts() {
    setNotice("");
    setSelectedExpense(null);
    setSettlementOpen(false);
    setEditingHouseholdSetting(null);
    setView("accounts");
  }

  function openMore() {
    setNotice("");
    setSelectedExpense(null);
    setSettlementOpen(false);
    setEditingHouseholdSetting(null);
    setView("more");
  }

  function updateTotal(nextValue: string) {
    setTotal(nextValue);
  }

  function assignPayment(profileId: string) {
    if (totalCents <= 0) return;
    const otherProfile = profiles.find((profile) => profile.id !== profileId);
    if (!otherProfile) return;

    setPaymentValues((current) => {
      const otherCents = eurosToCents(current[otherProfile.id] ?? "");
      if (otherCents >= totalCents) {
        return inputsFromSplit(totalCents, profiles.map((profile) => profile.id));
      }
      return { ...current, [profileId]: centsToInput(totalCents - otherCents) };
    });
  }

  function clearPayment(profileId: string) {
    if (totalCents <= 0) return;
    const otherProfile = profiles.find((profile) => profile.id !== profileId);
    if (!otherProfile) return;

    setPaymentValues((current) => ({
      ...current,
      [profileId]: centsToInput(0),
      [otherProfile.id]: centsToInput(totalCents),
    }));
  }

  function resetDraft() {
    const defaultCents = 4_860;
    setTotal(centsToInput(defaultCents));
    setCategory("Supermercado");
    setDate(localDateValue());
    setNote("");
    setPaymentValues({ dani: "", ana: "" });
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.valid || saving) return;
    setSaving(true);
    try {
      await addExpense({ name: note.trim() || category, category, date, amountCents: totalCents, payments });
      setNotice(mode === "synced" ? "Gasto guardado y sincronizado" : "Gasto guardado en este dispositivo");
      closeExpense(() => {
        setView("home");
        resetDraft();
      });
    } catch {
      setNotice("No se ha podido guardar el gasto");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSettlement() {
    if (!settlementProposal || savingSettlement) return;
    setSavingSettlement(true);
    try {
      await addSettlement({
        date: localDateValue(),
        amountCents: settlementProposal.amountCents,
        fromProfileId: settlementProposal.from.id,
        toProfileId: settlementProposal.to.id,
      });
      setSettlementOpen(false);
      setNotice(`Ajuste registrado: ${settlementProposal.from.name} ha pagado a ${settlementProposal.to.name}`);
    } catch {
      setSettlementOpen(false);
      setNotice("No se ha podido registrar el ajuste");
    } finally {
      setSavingSettlement(false);
    }
  }

  async function deleteMovement(expense: Expense) {
    await deleteExpense(expense.id);
    setNotice(expense.kind === "settlement" ? "Ajuste eliminado" : "Movimiento eliminado");
  }

  async function saveHouseholdSettings(settings: HouseholdSettings) {
    await updateHouseholdSettings(settings);
    setNotice(mode === "synced" ? "Configuración guardada y sincronizada" : "Configuración guardada en este dispositivo");
  }

  const validationMessages = [
    differenceMessage(validation.paymentDifference, "pagadores"),
  ].filter(Boolean);

  return (
    <main className="site-shell">
      <section className={`app-frame view-${view}`} aria-label="Gastos del hogar">
        <div className="app-surface">
          {view === "home" ? (
            <>
              <header className="topbar">
                <div><p className="eyebrow">Buenos días, {currentProfile.name}</p><h1>{householdSettings.householdName}</h1></div>
                <ProfileTools mode={mode} profile={currentProfile} onSignOut={isFirebaseConfigured ? signOut : undefined} />
              </header>

              <div className="page-content">
                {notice ? <div className="success-notice" role="status"><Check aria-hidden="true" />{notice}</div> : null}
                {storeError ? <div className="error-notice" role="alert">No podemos sincronizar ahora. Comprueba el acceso de Firebase.</div> : null}

                <div className="overview-grid">
                  <section className="summary-card" aria-label="Resumen mensual">
                    <div className="summary-heading">
                      <span>Gastos del mes</span>
                      <button type="button" className="month-button">Agosto 2026 <span aria-hidden="true">⌄</span></button>
                    </div>
                    <p className="monthly-total">{formatEuros(monthlyTotalCents)}</p>
                    <div className="budget-copy">
                      <span>Presupuesto</span>
                      <span>{formatEuros(monthlyTotalCents)} de {formatEuros(monthlyBudgetCents)}</span>
                    </div>
                    <div className="budget-track" role="progressbar" aria-label="Presupuesto utilizado" aria-valuenow={budgetPercent} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${budgetPercent}%` }} />
                    </div>
                  </section>

                  <section className="balance-card" aria-label="Tu balance">
                    <div>
                      <p className="card-label">Tu balance</p>
                      <p className="balance-amount">{signedEuros(currentBalanceCents)}</p>
                      <p className="supporting-copy">{currentBalanceCents >= 0 ? "A tu favor" : "Pendiente de aportar"}</p>
                    </div>
                    <button type="button" className="text-action" onClick={openAccounts}>Ver cuentas <ArrowRight aria-hidden="true" /></button>
                  </section>
                </div>

                <section className="movements-section" aria-labelledby="recent-title">
                  <div className="section-heading"><h2 id="recent-title">Movimientos recientes</h2><button type="button" className="text-action" onClick={openMovements}>Ver todos</button></div>
                  <div className="movement-list">
                    {sortedExpenses.length
                      ? sortedExpenses.slice(0, 3).map((expense) => <MovementRow expense={expense} profiles={profiles} onOpen={setSelectedExpense} key={expense.id} />)
                      : <p className="empty-state">Todavía no hay gastos. Añade el primero cuando quieras.</p>}
                  </div>
                </section>
              </div>
            </>
          ) : view === "movements" ? (
            <>
              <header className="topbar movements-header">
                <div><p className="eyebrow">Historial del hogar</p><h1>Movimientos</h1></div>
                <ProfileTools mode={mode} profile={currentProfile} onSignOut={isFirebaseConfigured ? signOut : undefined} />
              </header>

              <div className="page-content movements-page">
                {notice ? <div className="success-notice" role="status"><Check aria-hidden="true" />{notice}</div> : null}
                {storeError ? <div className="error-notice" role="alert">No podemos sincronizar ahora. Comprueba el acceso de Firebase.</div> : null}
                <section className="movements-summary" aria-label="Resumen de movimientos">
                  <div><p className="card-label">Gastos registrados</p><strong>{formatEuros(expenseMovements.reduce((sum, expense) => sum + expense.amountCents, 0))}</strong></div>
                  <span>{sortedExpenses.length} {sortedExpenses.length === 1 ? "movimiento" : "movimientos"}</span>
                </section>
                <section className="movements-section movements-all" aria-labelledby="all-movements-title">
                  <div className="section-heading"><h2 id="all-movements-title">Todos los movimientos</h2></div>
                  <div className="movement-list">
                    {sortedExpenses.length
                      ? sortedExpenses.map((expense) => <MovementRow expense={expense} profiles={profiles} onOpen={setSelectedExpense} key={expense.id} />)
                      : <p className="empty-state">Todavía no hay movimientos registrados.</p>}
                  </div>
                </section>
              </div>
            </>
          ) : view === "accounts" ? (
            <>
              <header className="topbar accounts-header">
                <div><p className="eyebrow">Balance compartido</p><h1>Cuentas</h1></div>
                <ProfileTools mode={mode} profile={currentProfile} onSignOut={isFirebaseConfigured ? signOut : undefined} />
              </header>

              <div className="page-content accounts-page">
                {notice ? <div className="success-notice" role="status"><Check aria-hidden="true" />{notice}</div> : null}
                {storeError ? <div className="error-notice" role="alert">No podemos sincronizar ahora. Comprueba el acceso de Firebase.</div> : null}

                <div className="accounts-legend" aria-hidden="true"><span><i className="legend-fill" />Aportación efectiva</span><span><i className="legend-target" />Objetivo de equilibrio</span></div>
                <div className="accounts-grid">
                  {accountSummaries.map(({ profile, contributedCents, allocatedCents, balanceCents }) => (
                    <section className="account-card" aria-label={`Cuenta de ${profile.name}`} key={profile.id}>
                      <header><span className="person-avatar">{profile.initial}</span><strong>{profile.name}</strong></header>
                      <div className="contribution-values"><div><span>Aportado</span><strong>{formatEuros(contributedCents)}</strong></div><div><span>Equilibrio</span><strong>{formatEuros(allocatedCents)}</strong></div></div>
                      <div className="contribution-track" role="img" aria-label={`${profile.name} ha aportado ${formatEuros(contributedCents)}; el equilibrio está en ${formatEuros(allocatedCents)}`}>
                        <span className="contribution-fill" style={{ width: `${Math.max(0, (contributedCents / contributionScaleCents) * 100)}%` }} />
                        <span className="contribution-target" style={{ left: `${Math.max(0, (allocatedCents / contributionScaleCents) * 100)}%` }} />
                      </div>
                      <div className="account-balance"><span>Balance</span><strong className={balanceCents >= 0 ? "is-positive" : "is-negative"}>{signedEuros(balanceCents)}</strong></div>
                    </section>
                  ))}
                </div>

                <section className={`accounts-status${settlementProposal ? " has-debt" : " is-settled"}`} aria-live="polite">
                  <span className="accounts-status-icon" aria-hidden="true">{settlementProposal ? <Scale /> : <Check />}</span>
                  <div>
                    <p className="eyebrow">{settlementProposal ? "Saldo pendiente" : "Todo en orden"}</p>
                    <h2>{settlementProposal ? <>{settlementProposal.from.name} debe pagar {formatEuros(settlementProposal.amountCents)} a {settlementProposal.to.name}</> : "Las cuentas están al día"}</h2>
                    <p>{settlementProposal ? "Registra el pago cuando se haya realizado para dejar el balance a cero." : `No hay pagos pendientes entre ${profiles[0].name} y ${profiles[1].name}.`}</p>
                  </div>
                  <button type="button" className="save-action accounts-settle-action" onClick={() => setSettlementOpen(true)} disabled={!settlementProposal}>Ajustar cuentas</button>
                </section>
              </div>
            </>
          ) : (
            <>
              <header className="topbar more-header">
                <div><p className="eyebrow">Personaliza tu experiencia</p><h1>Más</h1></div>
                <ProfileTools mode={mode} profile={currentProfile} onSignOut={isFirebaseConfigured ? signOut : undefined} />
              </header>

              <div className="page-content more-page">
                {notice ? <div className="success-notice more-notice" role="status"><Check aria-hidden="true" />{notice}</div> : null}
                {storeError ? <div className="error-notice more-notice" role="alert">No podemos sincronizar ahora. Comprueba el acceso de Firebase.</div> : null}
                <section className="more-section" aria-labelledby="household-settings-title">
                  <div className="more-section-heading"><div><h2 id="household-settings-title">Mi hogar</h2><p>Datos básicos y presupuesto compartido</p></div></div>
                  <div className="more-card more-settings-card">
                    <button type="button" className="more-setting-row" onClick={() => setEditingHouseholdSetting("name")}>
                      <span className="more-setting-icon" aria-hidden="true"><House /></span>
                      <span className="more-setting-copy"><strong>Nombre del hogar</strong><small>{householdSettings.householdName}</small></span>
                      <ChevronRight className="more-chevron" aria-hidden="true" />
                    </button>
                    <button type="button" className="more-setting-row" onClick={() => setEditingHouseholdSetting("people")}>
                      <span className="more-setting-icon" aria-hidden="true"><UsersRound /></span>
                      <span className="more-setting-copy"><strong>Personas</strong><small>{profiles[0].name} y {profiles[1].name}</small></span>
                      <span className="more-member-avatars" aria-hidden="true"><i>{profiles[0].initial}</i><i>{profiles[1].initial}</i></span>
                      <ChevronRight className="more-chevron" aria-hidden="true" />
                    </button>
                    <button type="button" className="more-setting-row" onClick={() => setEditingHouseholdSetting("budget")}>
                      <span className="more-setting-icon" aria-hidden="true"><WalletCards /></span>
                      <span className="more-setting-copy"><strong>Presupuesto mensual</strong><small>{formatEuros(monthlyBudgetCents)}</small></span>
                      <ChevronRight className="more-chevron" aria-hidden="true" />
                    </button>
                  </div>
                </section>

                <section className="more-section" aria-labelledby="recurring-title">
                  <div className="more-section-heading"><div><h2 id="recurring-title">Gastos recurrentes</h2><p>Organiza los pagos que se repiten</p></div></div>
                  <div className="more-card recurring-preview">
                    <span className="recurring-preview-icon" aria-hidden="true"><Repeat2 /></span>
                    <div><strong>Tus gastos habituales</strong><p>Alquiler, suministros o suscripciones, listos para repetir cada mes.</p></div>
                    <span className="more-add-action" aria-hidden="true"><Plus />Añadir recurrente</span>
                  </div>
                </section>

                <section className="more-section" aria-labelledby="categories-title">
                  <div className="more-section-heading"><div><h2 id="categories-title">Categorías</h2><p>Personaliza cómo organizas tus gastos</p></div></div>
                  <div className="more-card categories-preview">
                    <div className="category-preview-grid">
                      {categories.map((category) => <span className="category-preview-item" key={category}><i aria-hidden="true">{categoryIcon(category)}</i>{category}</span>)}
                    </div>
                    <div className="manage-categories-row">
                      <span><strong>Gestionar categorías</strong><small>Iconos, colores y orden</small></span>
                      <ChevronRight className="more-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>

        <nav className="bottom-navigation" aria-label="Navegación principal">
          <div className="nav-brand" aria-hidden="true"><span><House /></span><strong>{householdSettings.householdName}</strong><small>Gastos del hogar</small></div>
          <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={openHome}><House aria-hidden="true" />Inicio</button>
          <button type="button" aria-current={view === "movements" ? "page" : undefined} onClick={openMovements}><List aria-hidden="true" />Movimientos</button>
          <button type="button" className="nav-add" onClick={openExpense} aria-label="Añadir gasto"><Plus aria-hidden="true" /></button>
          <button type="button" aria-current={view === "accounts" ? "page" : undefined} onClick={openAccounts}><Scale aria-hidden="true" />Cuentas</button>
          <button type="button" aria-current={view === "more" ? "page" : undefined} onClick={openMore}><Menu aria-hidden="true" />Más</button>
        </nav>
      </section>
      {expenseOpen ? (
        <dialog ref={expenseDialogRef} className={`expense-entry-dialog${expenseVisible ? " is-visible" : ""}`} aria-labelledby="expense-entry-title" onCancel={(event) => { event.preventDefault(); closeExpense(); }} onClose={handleExpenseDialogClose}>
          <button type="button" className="expense-entry-backdrop" onClick={() => closeExpense()} tabIndex={-1} aria-label="Cerrar nuevo gasto" />
          <section className="expense-sheet" onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === "transform" && !expenseVisible) finishExpenseClose(); }}>
            <div className="expense-sheet-heading">
              <span className="expense-sheet-handle" aria-hidden="true" />
              <header className="editor-header">
                <div><p className="eyebrow">Nuevo movimiento</p><h1 id="expense-entry-title">Registrar gasto</h1></div>
                <button type="button" className="icon-button sheet-close" onClick={() => closeExpense()} aria-label="Cerrar nuevo gasto"><X aria-hidden="true" /></button>
              </header>
            </div>

            <form className="expense-form" onSubmit={saveExpense}>
              <div className="amount-field">
                <label htmlFor="expense-total">Importe</label>
                <div>
                  <input id="expense-total" type="number" inputMode="decimal" min="0" step="0.01" value={total} onChange={(event) => updateTotal(event.target.value)} onFocus={(event) => event.currentTarget.select()} />
                  <span>€</span>
                </div>
              </div>

              <div className="basic-fields">
                <label className="select-field"><Tag aria-hidden="true" /><span><small>Categoría</small><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((option) => <option key={option}>{option}</option>)}</select></span></label>
                <label className="date-field"><CalendarDays aria-hidden="true" /><span><small>Fecha</small><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></span></label>
              </div>

              <section className="form-section" aria-labelledby="payers-title">
                <div className="form-section-heading">
                  <div><h2 id="payers-title">Pagado por</h2><p>Quién adelantó el dinero</p></div>
                </div>
                <div className="share-list">
                  {profiles.map((profile) => {
                    return (
                      <div className="share-row" key={profile.id}>
                        <span className="person-identity"><span className="person-avatar">{profile.initial}</span><strong>{profile.name}</strong></span>
                        <span className="money-control">
                          <button type="button" className="payment-action payment-assign" onClick={() => assignPayment(profile.id)} disabled={totalCents <= 0} aria-label={`Asignar importe a ${profile.name}`} title="Asignar automáticamente"><WandSparkles aria-hidden="true" /></button>
                          <button type="button" className="payment-action payment-clear" onClick={() => clearPayment(profile.id)} disabled={totalCents <= 0} aria-label={`Vaciar importe de ${profile.name}`} title="Vaciar importe"><Eraser aria-hidden="true" /></button>
                          <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={paymentValues[profile.id] ?? ""} onChange={(event) => setPaymentValues((current) => ({ ...current, [profile.id]: event.target.value }))} onFocus={(event) => event.currentTarget.select()} aria-label={`Cantidad pagada por ${profile.name}`} />
                          <span>€</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <label className="note-field"><span>Nota <small>· opcional</small></span><input type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Por ejemplo, compra semanal" /></label>

              <div className={`validation-summary ${validation.valid ? "is-valid" : "is-error"}`} role="status">
                {validation.valid ? <><span><Check aria-hidden="true" /> Todo cuadra</span><strong>{formatEuros(totalCents)}</strong></> : <span>{validationMessages.join(" · ") || "Introduce un importe válido"}</span>}
              </div>

              <button type="submit" className="save-action" disabled={!validation.valid || saving}>{saving ? "Guardando…" : "Guardar gasto"}</button>
            </form>
          </section>
        </dialog>
      ) : null}
      {selectedExpense ? <ExpenseDetailModal expense={selectedExpense} profiles={profiles} currentProfile={currentProfile} onDelete={deleteMovement} onClose={() => setSelectedExpense(null)} /> : null}
      {settlementOpen && settlementProposal ? <SettlementConfirmModal proposal={settlementProposal} saving={savingSettlement} onConfirm={confirmSettlement} onClose={() => setSettlementOpen(false)} /> : null}
      {editingHouseholdSetting ? <HouseholdSettingsModal key={editingHouseholdSetting} setting={editingHouseholdSetting} settings={householdSettings} onSave={saveHouseholdSettings} onClose={() => setEditingHouseholdSetting(null)} /> : null}
    </main>
  );
}
