import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { splitEvenly, type MoneyShares } from "@/lib/domain";
import {
  getFirebaseClient,
  householdId,
  isFirebaseConfigured,
} from "@/lib/firebase/client";

export type Expense = {
  id: string;
  kind: "expense" | "settlement";
  name: string;
  category: string;
  date: string;
  amountCents: number;
  payments: MoneyShares;
  allocations: MoneyShares;
  settlementFromProfileId?: string;
  settlementToProfileId?: string;
  createdAtMillis: number;
};

export type ExpenseDraftRecord = Omit<Expense, "id" | "kind" | "allocations" | "createdAtMillis" | "settlementFromProfileId" | "settlementToProfileId">;

export type SettlementDraftRecord = {
  date: string;
  amountCents: number;
  fromProfileId: string;
  toProfileId: string;
};

export type ExpenseStoreMode =
  | "local"
  | "connecting"
  | "auth-required"
  | "synced"
  | "error";

const LOCAL_STORAGE_KEY = "mi-casa-expenses-v1";
const householdProfileIds = ["dani", "ana"];

function equalAllocations(amountCents: number): MoneyShares {
  return splitEvenly(amountCents, householdProfileIds);
}

const demoExpenses: Expense[] = [
  {
    id: "demo-mercadona",
    kind: "expense",
    name: "Mercadona",
    category: "Supermercado",
    date: "2026-08-22",
    amountCents: 6_235,
    payments: { dani: 6_235 },
    allocations: { dani: 3_118, ana: 3_117 },
    createdAtMillis: Date.parse("2026-08-22T09:30:00+02:00"),
  },
  {
    id: "demo-electricidad",
    kind: "expense",
    name: "Electricidad",
    category: "Suministros",
    date: "2026-08-21",
    amountCents: 7_810,
    payments: { ana: 7_810 },
    allocations: { dani: 3_905, ana: 3_905 },
    createdAtMillis: Date.parse("2026-08-21T18:10:00+02:00"),
  },
  {
    id: "demo-internet",
    kind: "expense",
    name: "Internet",
    category: "Suministros",
    date: "2026-08-18",
    amountCents: 3_990,
    payments: { dani: 3_990 },
    allocations: { dani: 1_995, ana: 1_995 },
    createdAtMillis: Date.parse("2026-08-18T12:00:00+02:00"),
  },
];

function loadLocalExpenses(): Expense[] {
  try {
    const serialized = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!serialized) return demoExpenses;
    const parsed = JSON.parse(serialized) as Expense[];
    return Array.isArray(parsed)
      ? parsed.map((expense) => {
          const kind = expense.kind === "settlement" ? "settlement" : "expense";
          return {
            ...expense,
            kind,
            allocations: kind === "settlement" ? {} : equalAllocations(expense.amountCents),
          };
        })
      : demoExpenses;
  } catch {
    return demoExpenses;
  }
}

function saveLocalExpenses(expenses: Expense[]) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
  } catch {
    // The app remains usable in memory when browser storage is unavailable.
  }
}

function expenseFromDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Expense {
  const data = snapshot.data();
  const kind = data.kind === "settlement" ? "settlement" : "expense";
  const amountCents = Number(data.amountCents ?? 0);
  return {
    id: snapshot.id,
    kind,
    name: String(data.name ?? data.category ?? "Gasto"),
    category: String(data.category ?? "Otros"),
    date: String(data.date ?? ""),
    amountCents,
    payments: (data.payments ?? {}) as MoneyShares,
    allocations: kind === "settlement" ? {} : equalAllocations(amountCents),
    settlementFromProfileId: data.settlementFromProfileId ? String(data.settlementFromProfileId) : undefined,
    settlementToProfileId: data.settlementToProfileId ? String(data.settlementToProfileId) : undefined,
    createdAtMillis:
      typeof data.createdAt?.toMillis === "function"
        ? data.createdAt.toMillis()
        : Number(data.createdAtMillis ?? 0),
  };
}

export function useExpenses() {
  const configured = isFirebaseConfigured();
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    configured ? [] : loadLocalExpenses(),
  );
  const [mode, setMode] = useState<ExpenseStoreMode>(
    configured ? "connecting" : "local",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) return;

    const client = getFirebaseClient();
    if (!client) return;

    let stopExpenses: Unsubscribe | undefined;
    const stopAuth = onAuthStateChanged(client.auth, (user) => {
      stopExpenses?.();
      stopExpenses = undefined;
      setError("");

      if (!user) {
        setExpenses([]);
        setMode("auth-required");
        return;
      }

      setMode("connecting");
      const expensesQuery = query(
        collection(client.database, "households", householdId, "expenses"),
        orderBy("createdAt", "desc"),
      );

      stopExpenses = onSnapshot(
        expensesQuery,
        (snapshot) => {
          setExpenses(snapshot.docs.map(expenseFromDocument));
          setMode("synced");
        },
        (firebaseError) => {
          setError(firebaseError.message);
          setMode("error");
        },
      );
    });

    return () => {
      stopExpenses?.();
      stopAuth();
    };
  }, [configured]);

  const addExpense = useCallback(
    async (draft: ExpenseDraftRecord) => {
      const record = {
        ...draft,
        allocations: equalAllocations(draft.amountCents),
      };

      if (!configured) {
        const expense: Expense = {
          ...record,
          kind: "expense",
          id: `expense-${crypto.randomUUID()}`,
          createdAtMillis: Date.now(),
        };
        setExpenses((current) => {
          const next = [expense, ...current];
          saveLocalExpenses(next);
          return next;
        });
        return;
      }

      const client = getFirebaseClient();
      if (!client?.auth.currentUser) throw new Error("La sesión familiar ha caducado");

      await addDoc(
        collection(client.database, "households", householdId, "expenses"),
        {
          ...record,
          kind: "expense",
          createdAt: serverTimestamp(),
          createdBy: client.auth.currentUser.uid,
        },
      );
    },
    [configured],
  );

  const addSettlement = useCallback(
    async (draft: SettlementDraftRecord) => {
      const record = {
        kind: "settlement" as const,
        name: "Ajuste de cuentas",
        category: "Ajuste",
        date: draft.date,
        amountCents: draft.amountCents,
        payments: {},
        allocations: {},
        settlementFromProfileId: draft.fromProfileId,
        settlementToProfileId: draft.toProfileId,
      };

      if (!configured) {
        const settlement: Expense = {
          ...record,
          id: `settlement-${crypto.randomUUID()}`,
          createdAtMillis: Date.now(),
        };
        setExpenses((current) => {
          const next = [settlement, ...current];
          saveLocalExpenses(next);
          return next;
        });
        return;
      }

      const client = getFirebaseClient();
      if (!client?.auth.currentUser) throw new Error("La sesión familiar ha caducado");

      await addDoc(
        collection(client.database, "households", householdId, "expenses"),
        {
          ...record,
          createdAt: serverTimestamp(),
          createdBy: client.auth.currentUser.uid,
        },
      );
    },
    [configured],
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      if (!configured) {
        setExpenses((current) => {
          const next = current.filter((expense) => expense.id !== expenseId);
          saveLocalExpenses(next);
          return next;
        });
        return;
      }

      const client = getFirebaseClient();
      if (!client?.auth.currentUser) throw new Error("La sesión familiar ha caducado");

      await deleteDoc(
        doc(client.database, "households", householdId, "expenses", expenseId),
      );
    },
    [configured],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase todavía no está configurado");
    setError("");
    setMode("connecting");
    try {
      await signInWithEmailAndPassword(client.auth, email, password);
    } catch (firebaseError) {
      setMode("auth-required");
      throw firebaseError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getFirebaseClient();
    if (client) await firebaseSignOut(client.auth);
  }, []);

  return {
    expenses,
    mode,
    error,
    isFirebaseConfigured: configured,
    addExpense,
    addSettlement,
    deleteExpense,
    signIn,
    signOut,
  };
}
